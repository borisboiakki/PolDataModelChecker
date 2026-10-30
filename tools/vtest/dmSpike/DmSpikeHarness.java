import java.io.*;
import java.util.*;
import java.util.regex.*;
import org.apache.velocity.Template;
import org.apache.velocity.VelocityContext;
import org.apache.velocity.app.VelocityEngine;
import org.apache.velocity.runtime.RuntimeServices;
import org.apache.velocity.runtime.log.LogSystem;

/**
 * Smoke test of the data model spike widget (tests/dmSpike-v0.1.x/spike-widget/dmSpike) with Velocity 1.4 on small mocks of
 * the Polarion objects it calls. It checks the template logic (parser, HTML conversion, binding SQL text), NOT the behaviour
 * of Polarion: the HTML stored by the rich-text editor, the EscapeTool getters and the APIs are what the spike on 2512 is for.
 * Usage: java DmSpikeHarness <spikeWidgetDir> <outDir>
 */
public class DmSpikeHarness {

    // ------------------------------------------------------------------ mocks

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
        public String toString() { return html; }
    }

    public static class Module {
        final String project, folder, name, title;
        final List<WorkItem> items = new ArrayList<WorkItem>();
        public Module(String project, String folder, String name) { this.project = project; this.folder = folder; this.name = name; this.title = name + " title"; }
        public boolean isUnresolvable() { return false; }
        public String getProjectId() { return project; }
        public String getModuleFolder() { return folder; }
        public String getId() { return name; }
        public String getTitle() { return title; }
        public String getRevision() { return null; }        // empty on 2512 (run 1) for a HEAD module
        public String getLastRevision() { return "4711"; }
    }

    public static class WorkItem {
        final String project, id, type, title;
        final Text desc;
        final Module module;
        public WorkItem(Module module, String project, String id, String type, String title, String html) {
            this.module = module; this.project = project; this.id = id; this.type = type; this.title = title; this.desc = new Text(html);
            if (module != null) { module.items.add(this); }
        }
        public boolean isUnresolvable() { return false; }
        public String getProjectId() { return project; }
        public String getId() { return id; }
        public Opt getType() { return new Opt(type, type); }
        public String getTitle() { return title; }
        public Text getDescription() { return desc; }
        public String getRevision() { return null; }        // empty on 2512 (run 1) for a HEAD work item
        public String getLastRevision() { return "4712"; }
        public Module getModule() { return module; }
        final List<Link> links = new ArrayList<Link>();
        public List<Link> getLinkedWorkItemsStructsDirect() { return links; }
        WorkItem link(String role, WorkItem target) { links.add(new Link(role, target)); return this; }
    }

    public static class Link {
        final Opt role;
        final WorkItem target;
        Link(String role, WorkItem target) { this.role = new Opt(role, role); this.target = target; }
        public Opt getLinkRole() { return role; }
        public WorkItem getLinkedItem() { return target; }
    }

    /** Rendering API objects: item with fields().description(), document with items().contained(). */
    public static class DescField {
        final WorkItem w;
        DescField(WorkItem w) { this.w = w; }
        public boolean isUnset() { return w.desc.html.isEmpty(); }
        public Text get() { return w.desc; }
        public String render() { return "<div class=\"polarion-rte\">" + w.desc.html + "</div>"; }
    }
    public static class Fields {
        final WorkItem w;
        Fields(WorkItem w) { this.w = w; }
        public DescField description() { return new DescField(w); }
    }
    public static class RItem {
        final WorkItem w;
        RItem(WorkItem w) { this.w = w; }
        public WorkItem getOldApi() { return w; }
        public Fields fields() { return new Fields(w); }
    }
    public static class Items {
        final Module m;
        Items(Module m) { this.m = m; }
        public List<RItem> contained() { List<RItem> l = new ArrayList<RItem>(); for (WorkItem w : m.items) { l.add(new RItem(w)); } return l; }
    }
    public static class Doc {
        final Module m;
        Doc(Module m) { this.m = m; }
        public boolean isUnresolvable() { return false; }
        public Module getOldApi() { return m; }
        public Items items() { return new Items(m); }
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
        public Enum getWorkItemTypeEnum() { return new Enum(Arrays.asList(new Opt("text", "Text"), new Opt("systemRequirement", "System Requirement"), new Opt("heading", "Heading"))); }
        public Enum getWorkItemLinkRoleEnum() { return new Enum(Arrays.asList(new Opt("satisfies", "satisfies", "is satisfied by"), new Opt("verifies", "verifies", "is verified by"))); }
    }

    static final List<Module> MODULES = new ArrayList<Module>();
    static final List<String> S7_SQL = new ArrayList<String>();

    static String grp(String sql, String re) {
        Matcher m = Pattern.compile(re).matcher(sql);
        return m.find() ? m.group(1) + (m.groupCount() > 1 ? "/" + m.group(2) : "") : null;
    }

    /** S10 forms (dmCheck queries): evaluated on the mock links. null = not an S10 query. */
    static List<Object> s10(String sql) {
        String src = grp(sql, "m[.]c_modulefolder = '([^']*)' AND m[.]c_id = '([^']*)'");
        String tgt = grp(sql, "mt[.]c_modulefolder = '([^']*)' AND mt[.]c_id = '([^']*)'");
        String role = grp(sql, "l[.]c_role = '([^']*)'");
        String st = grp(sql, "w[.]c_type = '([^']*)'");
        String tt = grp(sql, "t[.]c_type = '([^']*)'");
        boolean not = sql.contains("NOT IN (") || sql.contains("NOT EXISTS (");
        List<WorkItem> srcItems = new ArrayList<WorkItem>(), tgtItems = new ArrayList<WorkItem>();
        for (WorkItem w : ITEMS) {
            if (w.module == null) { continue; }
            String k = w.module.folder + "/" + w.module.name;
            if (k.equals(src) && (st == null || w.type.equals(st))) { srcItems.add(w); }
            if (k.equals(tgt) && (tt == null || w.type.equals(tt))) { tgtItems.add(w); }
        }
        Set<WorkItem> sources = new LinkedHashSet<WorkItem>(), targets = new LinkedHashSet<WorkItem>();
        for (WorkItem w : srcItems) { for (Link l : w.links) { if (l.role.id.equals(role) && tgtItems.contains(l.target)) { sources.add(w); targets.add(l.target); } } }
        List<Object> out = new ArrayList<Object>();
        if (sql.startsWith("SELECT DISTINCT w.c_uri FROM workitem w INNER JOIN struct_workitem_linkedworkitems")) { out.addAll(sources); return out; }
        if (sql.startsWith("SELECT t.c_uri FROM workitem t") && tgt != null) {
            for (WorkItem t : tgtItems) { if (!not || !targets.contains(t)) { out.add(t); } }
            return out;
        }
        if (sql.startsWith("SELECT w.c_uri FROM workitem w INNER JOIN module m") && src != null && !sql.contains("c_type IN (") && (not || st != null)) {
            for (WorkItem w : srcItems) { if (!not || !sources.contains(w)) { out.add(w); } }
            return out;
        }
        return null;
    }
    static final List<WorkItem> ITEMS = new ArrayList<WorkItem>();

    public static class DataService {
        public List<Object> sqlSearch(String sql) {
            List<Object> out = new ArrayList<Object>();
            S7_SQL.add(sql);
            String proj = "DMTEST";
            List<Object> s10 = s10(sql);
            if (s10 != null) { return s10; }
            // S7 forms (types per document, link sources): GROUP BY representatives (variants A, B) or everything (C).
            boolean typesRep = sql.startsWith("SELECT MIN(w.c_uri) FROM workitem w") || sql.startsWith("SELECT w.c_uri FROM workitem w WHERE w.c_uri IN (SELECT MIN(w.c_uri)");
            boolean typesAll = sql.startsWith("SELECT w.c_uri FROM workitem w INNER JOIN module m") && !sql.contains("m.c_modulefolder");
            if (typesRep || typesAll) {
                Set<String> seen = new HashSet<String>();
                for (WorkItem w : ITEMS) {
                    if (w.module == null || !w.module.project.equals(proj)) { continue; }
                    if (typesAll || seen.add(w.module.folder + "/" + w.module.name + "|" + w.type)) { out.add(w); }
                }
                return out;
            }
            boolean linkRep = sql.startsWith("SELECT MIN(ws.c_uri) FROM struct_workitem_linkedworkitems") || sql.startsWith("SELECT ws.c_uri FROM workitem ws WHERE ws.c_uri IN (SELECT MIN(ws.c_uri)");
            boolean linkAll = sql.startsWith("SELECT DISTINCT ws.c_uri FROM struct_workitem_linkedworkitems");
            if (linkRep || linkAll) {
                Set<String> seen = new HashSet<String>();
                for (WorkItem w : ITEMS) {
                    if (w.module == null || !w.module.project.equals(proj)) { continue; }
                    for (Link l : w.links) {
                        if (l.target.module == null) { continue; }
                        String g = w.module.name + "|" + l.target.module.project + "/" + l.target.module.name + "|" + l.role.id + "|" + w.type + "|" + l.target.type;
                        if (linkAll ? !out.contains(w) : seen.add(g)) { if (!out.contains(w)) { out.add(w); } }
                    }
                }
                return out;
            }
            if (sql.startsWith("SELECT m.c_uri FROM module m INNER JOIN project p ON p.c_uri = m.fk_uri_project WHERE p.c_id = '") && !sql.contains("(p.c_id")) {
                for (Module m : MODULES) { if (m.project.equals(proj)) { out.add(m); } }
                return out;
            }
            if (sql.startsWith("SELECT m.c_uri FROM module m")) {
                for (Module m : MODULES) {
                    if (sql.contains("(p.c_id = '" + m.project + "' AND m.c_modulefolder = '" + m.folder + "' AND m.c_id = '" + m.name + "')")) { out.add(m); }
                }
            } else if (sql.startsWith("SELECT w.c_uri FROM workitem w")) {
                for (WorkItem w : ITEMS) {
                    Module m = w.module;
                    if (m != null && sql.contains("p.c_id = '" + m.project + "' AND m.c_modulefolder = '" + m.folder + "' AND m.c_id = '" + m.name + "'")
                        && (!sql.contains("w.c_type IN (") || sql.contains("'" + w.type + "'"))) { out.add(w); }
                }
            } else {
                throw new RuntimeException("unexpected SQL: " + sql);
            }
            return out;
        }
    }
    public static class TrackerService {
        public DataService getDataService() { return new DataService(); }
        public TrackerProject getTrackerProject(String p) { return new TrackerProject(); }
        public WorkItem getWorkItem(String p, String id) {
            for (WorkItem w : ITEMS) { if (w.project.equals(p) && w.id.equals(id)) { return w; } }
            return null;
        }
        /** Lucene mock: only "project.id:P AND SQL:(<select>)" (S10 drill-down) is evaluated. */
        public List<Object> queryWorkItems(String q, String sort) {
            int i = q.indexOf("SQL:(");
            if (i < 0) { throw new RuntimeException("unexpected Lucene query in the mock: " + q); }
            return new DataService().sqlSearch(q.substring(i + 5, q.length() - 1));
        }
    }

    public static class ObjectFactory { public Map<Object, Object> newMap() { return new LinkedHashMap<Object, Object>(); } }
    /** EscapeTool mock: the getters the spike asks for (their presence on 2512 is a spike question). */
    public static class Esc {
        public String getB() { return "\\"; }
        public String getBackslash() { return "\\"; }
        public String getH() { return "#"; }
        public String getHash() { return "#"; }
        public String getD() { return "$"; }
        public String html(Object o) { return o == null ? null : o.toString().replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;"); }
    }
    /** EscapeTool without the backslash getters (fallback path). */
    public static class EscNoB extends Esc {
        public String getB() { return null; }
        public String getBackslash() { return null; }
    }
    public static class DateTool { public long getSystemTime() { return System.currentTimeMillis(); } }
    public static class Ref { public String projectId() { return "DMTEST"; } }
    public static class Page { public Ref getReference() { return new Ref(); } }
    public static class Target {
        final boolean pdf;
        Target(boolean pdf) { this.pdf = pdf; }
        public boolean isPdf() { return pdf; }
        public boolean isPrint() { return false; }
    }
    public static class WidgetContext {
        final Target t;
        WidgetContext(boolean pdf) { t = new Target(pdf); }
        public Target target() { return t; }
    }
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

    // ------------------------------------------------------------------ test set

    static final String[] SAMPLE = {
        "version: 1", "name: V-cycle model", "model:", "  roles:", "    SystemSpec:", "      title: System specification",
        "      items:", "        - type: systemRequirement", "          min: 1", "        - type: heading", "          ignored: true",
        "    SubsystemReq:", "      items:", "        - { type: subsystemRequirement, min: 1 }", "  links:", "    - id: L1",
        "      from: { role: SubsystemReq, type: subsystemRequirement }", "      link_role: satisfies",
        "      to: { role: SystemSpec, type: systemRequirement }", "      from_min: 1   # comment", "bindings:",
        "  SystemSpec: [Specs/System Specification]", "  SubsystemReq: [\"Specs/Subsystem A\", 'Specs/Subsystem B']" };

    /** Rich-text paste guess: one paragraph per line, leading spaces as &nbsp; (the real form is spike S1). */
    static String asParagraphs() {
        StringBuilder b = new StringBuilder();
        for (String l : SAMPLE) {
            int i = 0;
            while (i < l.length() && l.charAt(i) == ' ') { i++; }
            String body = l.substring(i).replace("&", "&amp;").replace("<", "&lt;").replace("\"", "&quot;").replace("'", "&#39;");
            b.append("<p>").append(i > 0 ? "&nbsp;".repeat(i) : "").append(body.isEmpty() ? "<br/>" : body).append("</p>");
        }
        return b.toString();
    }

    /** Form observed on 2512 (run 1, plain paste): one styled span per line, br separators, an empty line as a span
     *  holding a br, quotes as &quot;, indentation partly as no-break space characters (100 in the 48-line model). */
    static String asSpans() {
        StringBuilder b = new StringBuilder();
        String open = "<span style=\"font-size: 10pt;line-height: 1.5;\">";
        for (String l : SAMPLE) {
            int i = 0;
            while (i < l.length() && l.charAt(i) == ' ') { i++; }
            StringBuilder ind = new StringBuilder();
            for (int k = 0; k < i; k++) { ind.append(k % 2 == 0 ? ' ' : '\u00a0'); }
            String body = l.substring(i).replace("&", "&amp;").replace("<", "&lt;").replace("\"", "&quot;");
            b.append(open).append(ind).append(body.isEmpty() ? "<br/>" : body).append("</span><br/>");
        }
        return b.toString();
    }

    /** Code-block guess: one pre with newlines and no-break space characters for two of the indents. */
    static String asPre() {
        StringBuilder b = new StringBuilder("<p>Data model</p><pre>");
        for (String l : SAMPLE) { b.append(l.replace("&", "&amp;").replace("<", "&lt;").replace("    SubsystemReq", "    SubsystemReq")).append("\r\n"); }
        return b.append("</pre>").toString();
    }

    static Module modelDoc, preDoc, spanDoc;

    static void buildTestSet() {
        modelDoc = new Module("DMTEST", "Model", "Data Model");
        MODULES.add(modelDoc);
        ITEMS.add(new WorkItem(modelDoc, "DMTEST", "DM-1", "heading", "Data model", ""));
        ITEMS.add(new WorkItem(modelDoc, "DMTEST", "DM-2", "text", "Introduction", "<p>This document holds the data model.</p>"));
        ITEMS.add(new WorkItem(modelDoc, "DMTEST", "DM-3", "text", "Model", "<span># Comment line first, as in run 1 on 2512</span><br/>" + asParagraphs()));
        spanDoc = new Module("DMTEST", "Model", "Data Model Spans");
        MODULES.add(spanDoc);
        ITEMS.add(new WorkItem(spanDoc, "DMTEST", "DM-30", "text", "Model", asSpans()));
        preDoc = new Module("DMTEST", "Model", "Data Model Pre");
        MODULES.add(preDoc);
        ITEMS.add(new WorkItem(preDoc, "DMTEST", "DM-10", "text", "Model", asPre()));
        MODULES.add(new Module("DMTEST", "Specs", "System Specification"));
        MODULES.add(new Module("DMTEST", "_default", "Test Spec"));
        MODULES.add(new Module("SYSENG", "Specs", "Sub Spec"));
        ITEMS.add(new WorkItem(null, "SYSENG", "SE-12", "text", "Shared model", "<p>version: 1</p>"));
        // S7: a small V-cycle (customer spec <- system spec <- tests), a hierarchy, a link to another project.
        Module cus = new Module("DMTEST", "Specs", "Customer Spec");
        Module sys = new Module("DMTEST", "Specs", "System Spec");
        Module tst = new Module("DMTEST", "Tests", "System Tests");
        Module ext = new Module("SYSENG", "Specs", "External");
        MODULES.addAll(Arrays.asList(cus, sys, tst, ext));
        WorkItem c1 = add(cus, "C-1", "heading"), c2 = add(cus, "C-2", "customerRequirement"), c3 = add(cus, "C-3", "customerRequirement");
        WorkItem s1 = add(sys, "S-1", "systemRequirement"), s2 = add(sys, "S-2", "systemRequirement"), s3 = add(sys, "S-3", "systemRequirement");
        WorkItem t1 = add(tst, "T-1", "testCase"), t2 = add(tst, "T-2", "testCase");
        WorkItem e1 = new WorkItem(ext, "SYSENG", "E-1", "systemRequirement", "External", "");
        ITEMS.add(e1);
        s1.link("satisfies", c2); s2.link("satisfies", c2).link("satisfies", c3); s3.link("parent", s1).link("satisfies", e1);
        t1.link("verifies", s1); t2.link("verifies", s2).link("verifies", s3);
    }

    static WorkItem add(Module m, String id, String type) {
        WorkItem w = new WorkItem(m, m.project, id, type, "Title " + id, "");
        ITEMS.add(w);
        return w;
    }

    // ------------------------------------------------------------------ run

    static String render(String dir, String out, String name, Map<String, Param> p, boolean pdf, Esc esc) throws Exception {
        VelocityEngine ve = new VelocityEngine();
        ve.setProperty("file.resource.loader.path", dir);
        ve.setProperty("runtime.log.logsystem", new FileLog(out + "/velocity-" + name + ".log"));
        ve.init();
        VelocityContext ctx = new VelocityContext();
        ctx.put("parameters", p);
        ctx.put("page", new Page());
        ctx.put("widgetContext", new WidgetContext(pdf));
        ctx.put("trackerService", new TrackerService());
        ctx.put("objectFactory", new ObjectFactory());
        ctx.put("esc", esc);
        ctx.put("date", new DateTool());
        Template t = ve.getTemplate("render.vm", "UTF-8");
        StringWriter w = new StringWriter();
        t.merge(ctx, w);
        String html = w.toString();
        Writer fw = new OutputStreamWriter(new FileOutputStream(out + "/" + name + ".html"), "UTF-8");
        fw.write("<!doctype html><meta charset=utf-8><body>" + html);
        fw.close();
        check(!Pattern.compile("(?<![A-Za-z0-9_])[$][!]?[{]?[a-zA-Z]").matcher(html).find(), name + ": no unrendered Velocity reference");
        return html;
    }

    static Map<String, Param> params(String test, Module doc, String source, String docs, String remote) {
        Map<String, Param> p = new HashMap<String, Param>();
        p.put("test", new Param(test, null));
        p.put("doc", new Param(doc == null ? null : new DocOpt(doc), null));
        p.put("itemTypes", new Param(null, new ArrayList<Object>(Arrays.asList(new Opt("text", "Text")))));
        p.put("itemTypeSingle", new Param(new Opt("text", "Text"), null));
        p.put("itemId", new Param("", null));
        p.put("source", new Param(source, null));
        p.put("docs", new Param(docs, null));
        p.put("remote", new Param(remote, null));
        p.put("maxChars", new Param(Integer.valueOf(6000), null));
        p.put("s7Variant", new Param("min", null));
        p.put("s7Spaces", new Param("Specs, Tests", null));
        p.put("s7Max", new Param(Integer.valueOf(300), null));
        p.put("s10Src", new Param("Specs/System Spec", null));
        p.put("s10Tgt", new Param("Specs/Customer Spec", null));
        p.put("s10Role", new Param("satisfies", null));
        p.put("s10SrcType", new Param("", null));
        p.put("s10TgtType", new Param("", null));
        p.put("s10Variant", new Param("notin", null));
        return p;
    }

    static void check(boolean ok, String what) {
        if (!ok) { System.err.println("CHECK FAILED: " + what); System.exit(1); }
        System.out.println("check ok: " + what);
    }

    /** Value cell of a parsed path, or null. */
    static String val(String html, String path) {
        Matcher m = Pattern.compile("<td class=\"dm-path\">" + Pattern.quote(path) + "</td><td class=\"dm-val\">([^<]*)</td>").matcher(html);
        return m.find() ? m.group(1) : null;
    }

    static void checkModel(String h, String name) {
        check(h.contains("no problem"), name + ": parsed without problem");
        check("1".equals(val(h, "version")), name + ": version");
        check("systemRequirement".equals(val(h, "model.roles.SystemSpec.items[0].type")), name + ": block list of maps");
        check("true".equals(val(h, "model.roles.SystemSpec.items[1].ignored")), name + ": second list entry");
        check("{type=subsystemRequirement | min=1 | }".equals(val(h, "model.roles.SubsystemReq.items[0]")), name + ": flow map in a list");
        check("{role=SubsystemReq | type=subsystemRequirement | }".equals(val(h, "model.links[0].from")), name + ": flow map value");
        check("1".equals(val(h, "model.links[0].from_min")), name + ": end-of-line comment removed");
        check("[Specs/Subsystem A | Specs/Subsystem B | ]".equals(val(h, "bindings.SubsystemReq")), name + ": flow list with quotes");
        check(h.contains("top-level keys: [version, name, model, bindings]"), name + ": top-level keys");
    }

    public static void main(String[] args) throws Exception {
        buildTestSet();
        String dir = args[0];
        String out = args[1];
        new File(out).mkdirs();

        String h = render(dir, out, "all-paragraphs", params("all", modelDoc, "item", "Specs/System Specification, Test Spec, Missing, SYSENG/Specs/Sub Spec", "SYSENG/SE-12"), false, new Esc());
        check(h.contains("DM-3 (first item of the type with a line that starts with"), "S2: model item found after a text item without model keys, despite a leading comment");
        check(h.contains("revision  / last 4711"), "S2: document revision from getLastRevision()");
        check(h.contains("last revision 4712"), "S8: revision of the other project's item from getLastRevision()");
        check(h.contains("method === 'GET' ? u + '?fields[workitems]"), "S4: query parameter only on GET");
        check(h.contains("SQL (same document, types)</th><td>2 items"), "S2: SQL finds the two text items");
        check(h.contains("&lt;p&gt;version: 1&lt;/p&gt;"), "S1: raw HTML shown escaped");
        checkModel(h, "S3 paragraphs");
        check(h.contains("3 of 4 found"), "S5: 3 of 4 declared documents found (default space, other project)");
        check(h.contains("<td>satisfies</td><td>satisfies</td><td>is satisfied by</td>"), "S6: link roles listed");
        check(h.contains("<td>systemRequirement</td><td>System Requirement</td>"), "S6: types listed");
        check(h.contains("SYSENG/SE-12 read"), "S8: work item of another project read");
        check(h.contains("<script>") && h.contains("X-Polarion-REST-Token"), "S4: REST probe script in the browser view");
        check(h.contains("class=\"dms-ta\"") && h.contains("navigator.clipboard.writeText(ta.value)") && h.contains("select change event"), "S9: editor controls test in the browser view");

        h = render(dir, out, "yaml-spans", params("yaml", spanDoc, "item", "", ""), false, new Esc());
        checkModel(h, "S3 2512 form (spans, br, no-break space characters)");

        h = render(dir, out, "yaml-pre", params("yaml", preDoc, "item", "", ""), false, new Esc());
        checkModel(h, "S3 pre block (newlines, no-break spaces)");
        check(h.contains("1 non-empty lines before the first top-level model key skipped"), "S3 pre block: title paragraph skipped");

        h = render(dir, out, "yaml-sample", params("yaml", null, "sample", "", ""), false, new Esc());
        check(h.contains("no problem"), "S3 sample: parsed without problem");
        check("Subsystem requirements # not a comment".equals(val(h, "model.roles.SubsystemReq.title")), "S3 sample: hash inside quotes kept");
        check("warning".equals(val(h, "model.unexpected_links")), "S3 sample: key after a list at a lower indent");

        h = render(dir, out, "yaml-bad", params("yaml", null, "bad", "", ""), false, new Esc());
        check(h.contains("duplicate key model.roles.SystemSpec.title"), "S3 bad: duplicate key");
        check(h.contains("<td>7</td><td>unexpected indentation (3 spaces)"), "S3 bad: indentation with line number");
        check(h.contains("key where a list item was expected"), "S3 bad: key in a list");
        check(h.contains("empty list item"), "S3 bad: empty dash");
        check(h.contains("not in the YAML subset (anchor"), "S3 bad: anchor rejected");
        check(h.contains("nested flow collection"), "S3 bad: nested flow rejected");

        // S7: the three variants give the same types and link combinations; the starter YAML.
        String[] expectedCombos = {
            "<td>Specs/System Spec</td><td>systemRequirement</td><td>satisfies</td><td>Specs/Customer Spec</td><td>customerRequirement</td><td>3</td>",
            "<td>Specs/System Spec</td><td>systemRequirement</td><td>parent</td><td>Specs/System Spec</td><td>systemRequirement</td>",
            "<td>Tests/System Tests</td><td>testCase</td><td>verifies</td><td>Specs/System Spec</td><td>systemRequirement</td><td>3</td>" };
        for (String v : new String[] { "full", "min", "nested" }) {
            Map<String, Param> p7 = params("starter", null, "item", "", "");
            p7.put("s7Variant", new Param(v, null));
            S7_SQL.clear();
            h = render(dir, out, "s7-" + v, p7, false, new Esc());
            check(h.contains("Documents: 4 (max 300) &middot; with items: 3"), "S7 " + v + ": 4 documents of the spaces Specs and Tests, 3 with items");
            check(h.contains("<td>Specs/Customer Spec</td><td>heading (1) customerRequirement (" + (v.equals("full") ? "2" : "1") + ") </td>"), "S7 " + v + ": types of a document");
            check(h.contains(expectedCombos[1]), "S7 " + v + ": link inside a document (hierarchy)");
            if (v.equals("full")) {
                for (String c : expectedCombos) { check(h.contains(c), "S7 full: combination " + c.replaceAll("<[^>]*>", " ").trim()); }
                check(h.contains("links to documents out of scope: 1"), "S7 full: link to another project counted as out of scope");
            } else {
                check(h.contains(expectedCombos[0].substring(0, expectedCombos[0].lastIndexOf("<td>"))) && h.contains(expectedCombos[2].substring(0, expectedCombos[2].lastIndexOf("<td>"))), "S7 " + v + ": same combinations as the full scan");
            }
            check(S7_SQL.stream().anyMatch(q -> v.equals("min") ? q.startsWith("SELECT MIN(w.c_uri)") : v.equals("nested") ? q.contains("IN (SELECT MIN(w.c_uri)") : q.startsWith("SELECT w.c_uri FROM workitem w INNER JOIN")), "S7 " + v + ": query form");
            check(h.contains("count method: method not available"), "S7 " + v + ": count method reported");
            check(h.contains("    Customer_Spec:") && h.contains("        - { type: customerRequirement }") && h.contains("      from: { role: System_Spec, type: systemRequirement }")
                && h.contains("  System_Tests: [&quot;Tests/System Tests&quot;]"), "S7 " + v + ": starter YAML");
            if (v.equals("min")) {
                java.util.regex.Matcher ym = Pattern.compile("<pre class=\"s7-yaml\">(.*?)</pre>", Pattern.DOTALL).matcher(h);
                if (ym.find()) { Writer yw = new OutputStreamWriter(new FileOutputStream(out + "/s7-starter.yaml"), "UTF-8"); yw.write(ym.group(1).replace("&quot;", "\"").replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")); yw.close(); }
            }
        }
        h = render(dir, out, "all-no-s7", params("all", modelDoc, "item", "", ""), false, new Esc());
        check(!h.contains("S7 Starter generator data") && !h.contains("S10 dmCheck queries"), "S7 and S10 not run by the test All");

        // S10: reference (verified forms) and the set queries give the same items.
        for (String v : new String[] { "none", "notin", "notexists", "lucene" }) {
            Map<String, Param> p10 = params("checks", null, "item", "", "");
            p10.put("s10Variant", new Param(v, null));
            h = render(dir, out, "s10-" + v, p10, false, new Esc());
            check(h.contains("<td>Reference: source items without link</td><td>1</td><td>S-3 </td>") && h.contains("<td>Reference: target items not covered</td><td>1</td><td>C-1 </td>"), "S10 " + v + ": reference results");
            if (!v.equals("none")) {
                check(h.contains("same as the reference: yes") && h.contains(">yes (reference 1 / 1, " + v + " 1 / 1)<"), "S10 " + v + ": same as the reference");
            }
        }
        Map<String, Param> p10t = params("checks", null, "item", "", "");
        p10t.put("s10TgtType", new Param("customerRequirement", null));
        h = render(dir, out, "s10-types", p10t, false, new Esc());
        check(h.contains("<td>Reference: target items not covered</td><td>0</td>") && h.contains("same as the reference: yes") && h.contains("t.c_type = 'customerRequirement'"), "S10 with a target type: heading not counted");

        h = render(dir, out, "pdf", params("all", modelDoc, "item", "", ""), true, new Esc());
        check(!h.contains("<script"), "PDF: no script");

        h = render(dir, out, "no-backslash", params("yaml", preDoc, "item", "", ""), false, new EscNoB());
        check(h.contains("not available: newlines in pre blocks are not split"), "fallback: missing backslash reported");

        // Optional third argument: the sample model of test-data, pasted as paragraphs (what the PO pastes in S1/S3).
        if (args.length > 2) {
            List<String> lines = java.nio.file.Files.readAllLines(new File(args[2]).toPath(), java.nio.charset.StandardCharsets.UTF_8);
            StringBuilder b = new StringBuilder();
            for (String l : lines) {
                int i = 0;
                while (i < l.length() && l.charAt(i) == ' ') { i++; }
                String body = l.substring(i).replace("&", "&amp;").replace("<", "&lt;").replace("\"", "&quot;");
                b.append("<p>").append("&nbsp;".repeat(i)).append(body.isEmpty() ? "<br/>" : body).append("</p>");
            }
            Module sampleDoc = new Module("DMTEST", "Model", "Sample Model");
            MODULES.add(sampleDoc);
            ITEMS.add(new WorkItem(sampleDoc, "DMTEST", "DM-20", "text", "Model", b.toString()));
            h = render(dir, out, "yaml-test-data", params("yaml", sampleDoc, "item", "", ""), false, new Esc());
            check(h.contains("no problem") && "verifies".equals(val(h, "model.links[1].link_role")), "S3 test-data sample model: parsed without problem");
        }

        h = render(dir, out, "no-doc", params("all", null, "item", "", ""), false, new Esc());
        check(h.contains("no document selected") && h.contains("nothing parsed"), "no document: reported, nothing parsed");
        System.out.println("dmSpike harness: all checks passed");
    }
}
