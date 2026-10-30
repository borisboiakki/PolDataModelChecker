import java.io.*;
import java.util.*;
import org.apache.velocity.Template;
import org.apache.velocity.VelocityContext;
import org.apache.velocity.app.VelocityEngine;
import org.apache.velocity.runtime.RuntimeServices;
import org.apache.velocity.runtime.log.LogSystem;

/**
 * Mock Polarion objects for the data model widgets (dmDefine, later dmCheck), compiled with each harness
 * (tools/vtest/<widget>/*Harness.java) by tools/test-widget.sh. They follow what dmSpike observed on 2512 (run 1):
 * items().contained() in document order with getOldApi(), description HTML from getDescription().getContent(),
 * getRevision() empty and getLastRevision() set on HEAD objects, $esc.b = backslash, getWorkItemTypeEnum() /
 * getWorkItemLinkRoleEnum() options with id and name, sqlSearch on module returning Open API modules.
 * newMap() returns a HashMap: the templates must not rely on the key order of maps.
 */
public class DmMocks {

    public static class Opt {
        final String id, name, opposite;
        public Opt(String id, String name) { this(id, name, name); }
        public Opt(String id, String name, String opposite) { this.id = id; this.name = name; this.opposite = opposite; }
        public String getId() { return id; }
        public String getName() { return name; }
        public String getOppositeName() { return opposite; }
        public String id() { return id; }
        public String toString() { return "ProxyEnumOption id:" + id; }
    }

    public static class Text {
        final String html;
        public Text(String html) { this.html = html; }
        public String getType() { return "text/html"; }
        public String getContent() { return html; }
    }

    public static class Module {
        public final String project, folder, name, title;
        boolean unresolvable;
        final List<WorkItem> items = new ArrayList<WorkItem>();
        public Module(String project, String folder, String name, String title) { this.project = project; this.folder = folder; this.name = name; this.title = title; }
        public boolean isUnresolvable() { return unresolvable; }
        void check() { if (unresolvable) { throw new RuntimeException("uri: subterra:data-service:objects:/default/" + name); } }
        public String getProjectId() { check(); return project; }
        public String getModuleFolder() { check(); return folder; }
        public String getId() { check(); return name; }
        public String getTitle() { check(); return title; }
        public String getRevision() { return null; }
        public String getLastRevision() { return "4711"; }
    }

    public static class WorkItem {
        public final String project, id, type, title;
        public String html;
        final Module module;
        public WorkItem(Module module, String project, String id, String type, String title, String html) {
            this.module = module; this.project = project; this.id = id; this.type = type; this.title = title; this.html = html;
            if (module != null) { module.items.add(this); }
        }
        public boolean isUnresolvable() { return false; }
        public String getProjectId() { return project; }
        public String getId() { return id; }
        public Opt getType() { return new Opt(type, type); }
        public String getTitle() { return title; }
        public Text getDescription() { return new Text(html); }
        public String getRevision() { return null; }
        public String getLastRevision() { return "4712"; }
    }

    public static class RItem {
        final WorkItem w;
        RItem(WorkItem w) { this.w = w; }
        public WorkItem getOldApi() { return w; }
    }
    public static class Items {
        final Module m;
        Items(Module m) { this.m = m; }
        public List<RItem> contained() { List<RItem> l = new ArrayList<RItem>(); for (WorkItem w : m.items) { l.add(new RItem(w)); } return l; }
    }
    public static class Doc {
        final Module m;
        Doc(Module m) { this.m = m; }
        public boolean isUnresolvable() { return m.unresolvable; }
        public Module getOldApi() { m.check(); return m; }
        public Items items() { m.check(); return new Items(m); }
    }
    public static class DocOpt {
        final Module m;
        public DocOpt(Module m) { this.m = m; }
        public String id() { return m.folder + " / " + m.name; }
        public Doc getModelObject() { return new Doc(m); }
    }

    public static class Enum {
        final List<Opt> opts;
        Enum(List<Opt> opts) { this.opts = opts; }
        public List<Opt> getAllOptions() { return opts; }
    }
    public static class TrackerProject {
        public Enum getWorkItemTypeEnum() { return new Enum(TYPES); }
        public Enum getWorkItemLinkRoleEnum() { return new Enum(ROLES); }
    }

    public static final List<Opt> TYPES = new ArrayList<Opt>();
    public static final List<Opt> ROLES = new ArrayList<Opt>();
    public static final List<Module> MODULES = new ArrayList<Module>();
    public static final List<WorkItem> ITEMS = new ArrayList<WorkItem>();
    public static final List<String> SQL_LOG = new ArrayList<String>();

    public static class DataService {
        public List<Object> sqlSearch(String sql) {
            SQL_LOG.add(sql);
            List<Object> out = new ArrayList<Object>();
            if (sql.startsWith("SELECT m.c_uri FROM module m INNER JOIN project p ON p.c_uri = m.fk_uri_project WHERE ")) {
                for (Module m : MODULES) {
                    String cond = "(p.c_id = '" + m.project.replace("'", "''") + "' AND m.c_modulefolder = '" + m.folder.replace("'", "''")
                        + "' AND m.c_id = '" + m.name.replace("'", "''") + "')";
                    if (sql.contains(cond)) { out.add(m); }
                }
                return out;
            }
            throw new RuntimeException("unexpected SQL in the mock: " + sql);
        }
    }
    public static class TrackerService {
        public DataService getDataService() { return new DataService(); }
        public TrackerProject getTrackerProject(String p) { return new TrackerProject(); }
        public WorkItem getWorkItem(String p, String id) {
            for (WorkItem w : ITEMS) { if (w.project.equals(p) && w.id.equals(id)) { return w; } }
            return null;
        }
    }

    public static class ObjectFactory { public Map<Object, Object> newMap() { return new HashMap<Object, Object>(); } }
    public static class Esc {
        public String getB() { return "\\"; }
        public String getBackslash() { return "\\"; }
        public String getH() { return "#"; }
        public String getD() { return "$"; }
        public String html(Object o) { return o == null ? null : o.toString().replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;"); }
    }
    public static class Ref {
        final String p;
        Ref(String p) { this.p = p; }
        public String projectId() { return p; }
    }
    public static class Page {
        final String p;
        public Page(String p) { this.p = p; }
        public Ref getReference() { return new Ref(p); }
    }
    public static class Target {
        final boolean pdf, print;
        Target(boolean pdf, boolean print) { this.pdf = pdf; this.print = print; }
        public boolean isPdf() { return pdf; }
        public boolean isPrint() { return print; }
        public boolean isEditor() { return false; }
    }
    public static class WidgetContext {
        final Target t;
        WidgetContext(boolean pdf, boolean print) { t = new Target(pdf, print); }
        public Target target() { return t; }
    }
    /** Parameter object: only method-style accessors, like the API observed on 2512. */
    public static class Param {
        final Object value;
        final List<Object> values;
        public Param(Object value, List<Object> values) { this.value = value; this.values = values; }
        public Object value() { return value; }
        public Object singleValue() { return value; }
        public List<Object> values() { return values; }
    }
    public static class FileLog implements LogSystem {
        private final PrintWriter out;
        public FileLog(String file) throws IOException { out = new PrintWriter(new FileWriter(file)); }
        public void init(RuntimeServices rs) { }
        public void logVelocityMessage(int level, String message) { out.println(level + " " + message); out.flush(); }
    }

    // ------------------------------------------------------------------ helpers

    /** Description HTML as stored on 2512 for a plain paste (dmSpike run 1): one styled span per line, br separators,
     *  indentation as spaces and U+00A0 characters, quotes as &quot;. */
    public static String asStoredHtml(List<String> lines) {
        StringBuilder b = new StringBuilder();
        String open = "<span style=\"font-size: 10pt;line-height: 1.5;\">";
        for (String l : lines) {
            int i = 0;
            while (i < l.length() && l.charAt(i) == ' ') { i++; }
            StringBuilder ind = new StringBuilder();
            for (int k = 0; k < i; k++) { ind.append(k % 2 == 0 ? ' ' : ' '); }
            String body = l.substring(i).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
            b.append(open).append(ind).append(body.isEmpty() ? "<br/>" : body).append("</span><br/>");
        }
        return b.toString();
    }

    public static String render(String widgetDir, String project, Map<String, Param> params, boolean pdf, boolean print, String logFile) throws Exception {
        VelocityEngine ve = new VelocityEngine();
        ve.setProperty("file.resource.loader.path", widgetDir);
        ve.setProperty("runtime.log.logsystem", new FileLog(logFile));
        ve.init();
        VelocityContext ctx = new VelocityContext();
        ctx.put("parameters", params);
        ctx.put("page", new Page(project));
        ctx.put("widgetContext", new WidgetContext(pdf, print));
        ctx.put("trackerService", new TrackerService());
        ctx.put("objectFactory", new ObjectFactory());
        ctx.put("esc", new Esc());
        Template t = ve.getTemplate("render.vm", "UTF-8");
        StringWriter w = new StringWriter();
        t.merge(ctx, w);
        return w.toString();
    }

    public static void write(String file, String text) throws IOException {
        Writer w = new OutputStreamWriter(new FileOutputStream(file), "UTF-8");
        w.write(text);
        w.close();
    }

    public static void check(boolean ok, String what) {
        if (!ok) { System.err.println("CHECK FAILED: " + what); System.exit(1); }
        System.out.println("check ok: " + what);
    }
}
