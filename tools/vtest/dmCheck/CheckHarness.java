import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.*;
import java.util.regex.*;

/**
 * Renders the built dmCheck widget (widgets/dmCheck/dist/dmCheck/render.vm) with Velocity 1.4 against the mocks of
 * tools/vtest/dmmocks/DmMocks.java. The project is built from test-data/vcycle-check/structure.md (documents, items,
 * links) and the model from test-data/vcycle-check/model.yaml; the expected violations are read from the same
 * structure.md, so the documentation and the test cannot drift apart. It checks the template logic, NOT Polarion's
 * behaviour (docs/PO_CHECKS.md section 3 compares with 2512).
 * Usage: java CheckHarness <widgetDir> <outDir> <repoRoot>
 */
public class CheckHarness {

    static final String P = "DMTEST";
    static final Map<String, DmMocks.Module> DOCS = new LinkedHashMap<String, DmMocks.Module>();
    static final Map<String, DmMocks.WorkItem> ITEMS = new LinkedHashMap<String, DmMocks.WorkItem>();
    static final List<String[]> EXPECTED = new ArrayList<String[]>();
    static List<String> modelLines;
    static int linkCount = 0;

    static List<String[]> table(List<String> lines, String heading) {
        List<String[]> rows = new ArrayList<String[]>();
        int i = 0;
        while (i < lines.size() && !lines.get(i).startsWith(heading)) { i++; }
        for (i++; i < lines.size(); i++) {
            String l = lines.get(i).trim();
            if (l.startsWith("## ")) { break; }
            if (!l.startsWith("|") || l.startsWith("|---") || l.startsWith("| Document") || l.startsWith("| #")) { continue; }
            String[] c = l.substring(1, l.length() - 1).split("[|]", -1);
            for (int k = 0; k < c.length; k++) { c[k] = c[k].trim(); }
            rows.add(c);
        }
        return rows;
    }

    static void buildTestSet(String root) throws IOException {
        for (String t : new String[] { "text", "heading", "customerRequirement", "requirement", "testCase", "information" }) { DmMocks.TYPES.add(new DmMocks.Opt(t, t)); }
        DmMocks.ROLES.add(new DmMocks.Opt("satisfies", "satisfies", "is satisfied by"));
        DmMocks.ROLES.add(new DmMocks.Opt("verifies", "verifies", "is verified by"));
        DmMocks.ROLES.add(new DmMocks.Opt("parent", "has parent", "is parent of"));
        File dir = new File(root, "test-data/vcycle-check");
        List<String> st = Files.readAllLines(new File(dir, "structure.md").toPath(), StandardCharsets.UTF_8);
        modelLines = Files.readAllLines(new File(dir, "model.yaml").toPath(), StandardCharsets.UTF_8);
        String doc = null;
        Map<String, String> links = new LinkedHashMap<String, String>();
        for (String[] c : table(st, "## Documents and items")) {
            if (!c[0].isEmpty()) {
                doc = c[0];
                String[] f = doc.split("/");
                DmMocks.Module m = new DmMocks.Module(P, f[0], f[1], f[1]);
                DOCS.put(doc, m);
                DmMocks.MODULES.add(m);
            }
            DmMocks.WorkItem w = new DmMocks.WorkItem(DOCS.get(doc), P, c[1], c[2], c[1], "");
            ITEMS.put(c[1], w);
            DmMocks.ITEMS.add(w);
            links.put(c[1], c[3]);
        }
        for (Map.Entry<String, String> e : links.entrySet()) {
            for (String part : e.getValue().split(";")) {
                String[] f = part.trim().split(" ");
                if (f.length == 2) { ITEMS.get(e.getKey()).link(f[0], ITEMS.get(f[1])); linkCount++; }
            }
        }
        for (String[] c : table(st, "## Expected violations")) { EXPECTED.add(c); }
    }

    static DmMocks.Module modelDoc(String name, List<String> lines) {
        DmMocks.Module d = new DmMocks.Module(P, "Model", name, name);
        DmMocks.MODULES.add(d);
        DmMocks.ITEMS.add(new DmMocks.WorkItem(d, P, "DM-" + name.replace(' ', '-'), "text", "Model", DmMocks.asStoredHtml(lines)));
        return d;
    }

    static Map<String, DmMocks.Param> params(DmMocks.Module doc) {
        Map<String, DmMocks.Param> p = new HashMap<String, DmMocks.Param>();
        p.put("doc", new DmMocks.Param(doc == null ? null : new DmMocks.DocOpt(doc), null));
        p.put("itemTypes", new DmMocks.Param(null, new ArrayList<Object>(Arrays.asList(new DmMocks.Opt("text", "Text")))));
        p.put("itemId", new DmMocks.Param("", null));
        p.put("listCap", new DmMocks.Param(Integer.valueOf(500), null));
        p.put("height", new DmMocks.Param(Integer.valueOf(500), null));
        return p;
    }

    static String run(String dir, String out, String name, Map<String, DmMocks.Param> p, boolean pdf) throws Exception {
        String html = DmMocks.render(dir, P, p, pdf, false, out + "/velocity-" + name + ".log");
        DmMocks.write(out + "/" + name + "-fragment.html", html);
        DmMocks.check(!Pattern.compile("(?<![A-Za-z0-9_])[$][!]?[{]?[a-zA-Z]").matcher(html).find(), name + ": no unrendered Velocity reference");
        DmMocks.check(!html.contains("#dc") && !html.contains("#dm"), name + ": no unexpanded macro");
        return html;
    }

    static int count(String html, String what) {
        int n = 0;
        for (int i = html.indexOf(what); i >= 0; i = html.indexOf(what, i + 1)) { n++; }
        return n;
    }

    static final Map<String, String> KINDS = new HashMap<String, String>();
    static {
        KINDS.put("Unexpected type", "unexpected-type");
        KINDS.put("Missing link (from)", "from");
        KINDS.put("Not covered (to)", "to");
        KINDS.put("Cross-pair link", "cross-pair");
        KINDS.put("Unexpected link", "unexpected-link");
        KINDS.put("Unpaired document", "unpaired");
    }

    static boolean hasViolation(String html, String sev, String kind, String rule, String item) {
        Matcher m = Pattern.compile("<i class=\"dc-v\" data-sev=\"" + Pattern.quote(sev) + "\" data-kind=\"" + Pattern.quote(kind) + "\" data-rule=\""
            + Pattern.quote(rule) + "\" data-doc=\"[^\"]*\" data-item=\"" + Pattern.quote(item) + "\"").matcher(html);
        return m.find();
    }

    static List<String> without(List<String> lines, String fromLine) {
        List<String> out = new ArrayList<String>();
        for (String l : lines) { if (l.startsWith(fromLine)) { break; } out.add(l); }
        return out;
    }

    public static void main(String[] args) throws Exception {
        String dir = args[0];
        String out = args[1];
        buildTestSet(args[2]);
        new File(out).mkdirs();
        DmMocks.check(DOCS.size() == 5 && ITEMS.size() == 20 && EXPECTED.size() == 11, "test structure read from structure.md: 5 documents, 20 items, 11 expected violations");

        String h = run(dir, out, "browser", params(modelDoc("Check Model", modelLines)), false);
        DmMocks.check(h.contains("data-run=\"1\"") && h.contains("data-items=\"20\"") && h.contains("data-links=\"" + linkCount + "\""), "checks ran: 20 items, " + linkCount + " links");
        DmMocks.check(count(h, "<i class=\"dm-p\"") == 0, "model: no problem");
        for (String[] e : EXPECTED) {
            String kind = KINDS.get(e[1]);
            String rule = e[2].equals("—") ? "" : e[2].replace("types ", "types:");
            String item = e[5].isEmpty() ? "" : P + "/" + e[5];
            DmMocks.check(hasViolation(h, e[3], kind, rule, item), "expected violation " + e[0] + ": " + e[1] + " " + e[2] + " " + e[5]);
        }
        DmMocks.check(count(h, "<i class=\"dc-v\"") == EXPECTED.size(), "exactly the " + EXPECTED.size() + " expected violations");
        DmMocks.check(h.contains("data-id=\"L1\"") && h.contains("data-fc=\"7\" data-fo=\"5\" data-tc=\"4\" data-to2=\"3\" data-cross=\"0\" data-unp=\"0\""), "counters L1 (structure.md)");
        DmMocks.check(h.contains("data-fc=\"6\" data-fo=\"4\" data-tc=\"7\" data-to2=\"4\" data-cross=\"1\" data-unp=\"0\""), "counters L2 (structure.md)");
        DmMocks.check(h.contains("<i class=\"dc-d\" data-k=\"DMTEST/Specs/Customer Specification\" data-roles=\"CustomerSpec;\" data-items=\"5\" data-bad=\"2\""), "document counters (heading ignored, CUS-5 and CUS-6 with a violation)");
        DmMocks.check(h.contains("data-k=\"types:CustomerSpec|unexpected-type\" data-n=\"1\""), "full counts per rule and check");

        // Pooled instead of paired: the cross-pair link of STA-3 counts, no cross-pair violation.
        h = run(dir, out, "pooled", params(modelDoc("Pooled Model", without(modelLines, "pairs:"))), false);
        DmMocks.check(!h.contains("data-kind=\"cross-pair\"") && !hasViolation(h, "warning", "from", "L2", "DMTEST/STA-3") && hasViolation(h, "warning", "from", "L2", "DMTEST/STA-4"), "pooled L2: STA-3 compliant, STA-4 still reported");
        DmMocks.check(h.contains("data-fc=\"6\" data-fo=\"5\""), "pooled L2: 5 of 6 test cases compliant");

        // One pair only: Solution Spec B and STD B unpaired.
        List<String> onePair = without(modelLines, "    - [\"Tests/STD B\"");
        h = run(dir, out, "unpaired", params(modelDoc("One Pair", onePair)), false);
        DmMocks.check(count(h, "data-kind=\"unpaired\"") == 2 && h.contains("Document DMTEST/Specs/Solution Spec B (role SolutionSpec) is in no pair of L2.") && h.contains("Document DMTEST/Tests/STD B (role SolutionSTD) is in no pair of L2."), "unpaired documents reported");

        // unexpected_links: ignore -> no unexpected link.
        List<String> ign = new ArrayList<String>();
        for (String l : modelLines) { ign.add(l.equals("  unexpected_links: warning") ? "  unexpected_links: ignore" : l); }
        h = run(dir, out, "ignore", params(modelDoc("Ignore Model", ign)), false);
        DmMocks.check(!h.contains("data-kind=\"unexpected-link\"") && count(h, "<i class=\"dc-v\"") == EXPECTED.size() - 1, "unexpected_links ignore: not reported");

        // A model with an error: nothing is checked.
        List<String> bad = new ArrayList<String>(modelLines);
        bad.set(bad.indexOf("      link_role: satisfies"), "      link_role: nosuchrole");
        h = run(dir, out, "model-error", params(modelDoc("Bad Model", bad)), false);
        DmMocks.check(h.contains("data-run=\"0\"") && h.contains("The model has errors") && count(h, "<i class=\"dc-v\"") == 0 && h.contains("Link role nosuchrole does not exist"), "model with an error: problems listed, nothing checked");

        // List cap: 1 per rule and check, full counts kept.
        Map<String, DmMocks.Param> capped = params(modelDoc("Capped Model", modelLines));
        capped.put("listCap", new DmMocks.Param(Integer.valueOf(1), null));
        h = run(dir, out, "capped", capped, false);
        DmMocks.check(count(h, "data-kind=\"to\" data-rule=\"L2\"") == 1 && h.contains("data-k=\"L2|to\" data-n=\"3\""), "list cap: 1 listed, full count 3 kept");

        h = run(dir, out, "pdf", params(modelDoc("Pdf Model", modelLines)), true);
        DmMocks.check(!h.contains("<script") && h.contains("<td>L1</td><td>SolutionSpec</td><td>satisfies</td><td>CustomerSpec</td><td>5 / 7</td><td>3 / 4</td><td>0</td><td>0</td><td>error</td>"), "PDF: rules table");
        DmMocks.check(h.contains("Violations (11 listed)"), "PDF: violations table");

        h = run(dir, out, "nodoc", params(null), false);
        DmMocks.check(h.contains("select the model document"), "no document: hint");
        System.out.println("dmCheck harness: all checks passed");
    }
}
