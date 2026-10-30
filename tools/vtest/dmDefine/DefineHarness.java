import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.*;
import java.util.regex.*;

/**
 * Renders the built dmDefine widget (widgets/dmDefine/dist/dmDefine/render.vm) with Velocity 1.4 against the mocks of
 * tools/vtest/dmmocks/DmMocks.java and checks the output. It checks the template logic, NOT Polarion's behaviour
 * (that is what the spikes on 2512 are for).
 * Usage: java DefineHarness <widgetDir> <outDir> <repoRoot>
 * Writes browser-fragment.html (valid model), errors-fragment.html (model with problems), pdf-fragment.html,
 * pdf-errors-fragment.html, syntax-fragment.html, velocity-*.log.
 */
public class DefineHarness {

    static final String P = "DMTEST";
    static DmMocks.Module modelDoc, errorsDoc, syntaxDoc, emptyDoc, pairedDoc, pairErrDoc;
    static final Map<String, DmMocks.Module> USES_DOCS = new LinkedHashMap<String, DmMocks.Module>();

    /** Local part of a model that reuses the roles and rules of SYSENG/SE-12 (uses:, dmDefine 0.4.0). */
    static final String[] USES_MODEL = {
        "# Local part: roles and rules come from the shared model", "version: 1", "name: Reused V-cycle", "uses: \"SYSENG/SE-12\"",
        "bindings:", "  SystemSpec: [\"Specs/System Specification\"]", "  SubsystemReq: [\"Specs/Subsystem A Requirements\"]",
        "  SystemTest: [\"Tests/System Tests\", \"SYSENG/Tests/Shared Tests\"]" };

    /** Use case 3 of docs/MODELING_GUIDE.md: pooled satisfies, paired verifies. */
    static final String[] PAIRED_MODEL = {
        "version: 1", "name: Solutions with their own STD", "model:", "  roles:", "    CustomerSpec:", "      items:",
        "        - { type: systemRequirement, min: 1 }", "    SolutionSpec:", "      items:", "        - { type: subsystemRequirement, min: 1 }",
        "    SolutionSTD:", "      items:", "        - { type: testCase, min: 1 }", "  links:", "    - id: L1",
        "      from: { role: SolutionSpec, type: subsystemRequirement }", "      link_role: satisfies",
        "      to: { role: CustomerSpec, type: systemRequirement }", "      from_min: 1", "      to_min: 1",
        "      from_severity: info", "    - id: L2",
        "      from: { role: SolutionSTD, type: testCase }", "      link_role: verifies", "      to: { role: SolutionSpec, type: subsystemRequirement }",
        "      from_min: 1", "      to_min: 1", "bindings:", "  CustomerSpec: [\"Specs/System Specification\"]",
        "  SolutionSpec: [\"Specs/Solution Spec A\", \"Specs/Solution Spec B\"]", "  SolutionSTD: [\"Tests/STD A\", \"Tests/STD B\"]",
        "pairs:", "  L2:", "    - [\"Tests/STD A\", \"Specs/Solution Spec A\"]", "    - [\"Tests/STD B\", \"Specs/Solution Spec B\"]" };

    /** Mistakes in pairs: duplicate, reversed pair, incomplete pair, unknown rule, unpaired documents. */
    static final String[] PAIR_ERRORS_MODEL = {
        "version: 1", "model:", "  roles:", "    Spec:", "      items:", "        - { type: systemRequirement }", "    Test:",
        "      items:", "        - { type: testCase }", "  links:", "    - id: V1", "      from: { role: Test, type: testCase }",
        "      link_role: verifies", "      to: { role: Spec, type: systemRequirement }", "      to_min: 1", "bindings:",
        "  Spec: [\"Specs/Solution Spec A\", \"Specs/Solution Spec B\"]", "  Test: [\"Tests/STD A\", \"Tests/STD B\"]", "pairs:", "  V1:",
        "    - [\"Tests/STD A\", \"Specs/Solution Spec A\"]", "    - [\"Tests/STD A\", \"Specs/Solution Spec A\"]",
        "    - [\"Specs/Solution Spec B\", \"Tests/STD B\"]", "    - [\"Tests/STD A\"]", "  V9:", "    - [a, b]" };
    static int SAMPLE_LINES, SPEC_LINE;

    static final String[] ERRORS_MODEL = {
        "# A model with problems on purpose (harness)", "version: 2", "model:", "  roles:", "    SystemSpec:",
        "      title: System specification", "      items:", "        - type: systemRequirement", "          min: 3",
        "          max: 1", "        - { type: unknownType }", "      unexpected_types: sometimes", "      colour: blue",
        "    SubsystemReq:", "      items:", "        - { type: subsystemRequirement, min: x }", "  links:", "    - id: L1",
        "      from: { role: SubsystemReq, type: subsystemRequirement }", "      link_role: unknown_role",
        "      to: { role: Nowhere }", "    - id: L1", "      from: { role: SubsystemReq }", "      link_role: satisfies",
        "      to: { role: SystemSpec, type: testCase }", "      severity: fatal", "      to_severity: never", "    - id: P1",
        "      from: { role: SystemSpec, type: systemRequirement }", "      link_role: parent",
        "      to: { role: SystemSpec, type: systemRequirement }", "bindings:", "  SystemSpec: [Specs/Missing Doc, Specs/System Specification]",
        "  Other: Specs/System Specification", "uses: \"X/Y-1\"" };

    static final String[] SYNTAX_MODEL = {
        "version: 1", "model:", "  roles:", "    A:", "      title: First", "      title: Again", "   bad: indentation",
        "    B:", "      items:", "        - type: text", "        -", "      items2: [a, [b]]", "bindings:", "  A: [x]" };

    static void buildTestSet(String root) throws IOException {
        for (String[] t : new String[][] { { "text", "Text" }, { "heading", "Heading" }, { "systemRequirement", "System Requirement" },
            { "subsystemRequirement", "Subsystem Requirement" }, { "testCase", "Test Case" } }) {
            DmMocks.TYPES.add(new DmMocks.Opt(t[0], t[1]));
        }
        DmMocks.ROLES.add(new DmMocks.Opt("satisfies", "satisfies", "is satisfied by"));
        DmMocks.ROLES.add(new DmMocks.Opt("verifies", "verifies", "is verified by"));
        DmMocks.ROLES.add(new DmMocks.Opt("parent", "has parent", "is parent of"));
        modelDoc = new DmMocks.Module(P, "Model", "Data Model", "Data Model");
        errorsDoc = new DmMocks.Module(P, "Model", "Errors Model", "Errors Model");
        syntaxDoc = new DmMocks.Module(P, "Model", "Syntax Model", "Syntax Model");
        emptyDoc = new DmMocks.Module(P, "Model", "Empty", "Empty");
        pairedDoc = new DmMocks.Module(P, "Model", "Paired Model", "Paired Model");
        pairErrDoc = new DmMocks.Module(P, "Model", "Pair Errors", "Pair Errors");
        DmMocks.MODULES.addAll(Arrays.asList(pairedDoc, pairErrDoc,
            new DmMocks.Module(P, "Specs", "Solution Spec A", "Solution Spec A"), new DmMocks.Module(P, "Specs", "Solution Spec B", "Solution Spec B"),
            new DmMocks.Module(P, "Tests", "STD A", "STD A"), new DmMocks.Module(P, "Tests", "STD B", "STD B")));
        DmMocks.Module sysSpec = new DmMocks.Module(P, "Specs", "System Specification", "System Specification");
        DmMocks.Module subA = new DmMocks.Module(P, "Specs", "Subsystem A Requirements", "Subsystem A Requirements");
        DmMocks.Module sysTests = new DmMocks.Module(P, "Tests", "System Tests", "System Tests");
        DmMocks.MODULES.addAll(Arrays.asList(modelDoc, errorsDoc, syntaxDoc, emptyDoc, sysSpec, subA,
            new DmMocks.Module(P, "Specs", "Subsystem B Requirements", "Subsystem B Requirements"), sysTests));
        // Items and links for the starter generator (D8): a small V-cycle; expected proposal in the browser check.
        DmMocks.WorkItem sys1 = new DmMocks.WorkItem(sysSpec, P, "SYS-1", "systemRequirement", "System req 1", "");
        DmMocks.WorkItem sys2 = new DmMocks.WorkItem(sysSpec, P, "SYS-2", "systemRequirement", "System req 2", "");
        DmMocks.WorkItem sysH = new DmMocks.WorkItem(sysSpec, P, "SYS-0", "heading", "Chapter", "");
        DmMocks.WorkItem sub1 = new DmMocks.WorkItem(subA, P, "SUB-1", "subsystemRequirement", "Sub req 1", "");
        DmMocks.WorkItem sub2 = new DmMocks.WorkItem(subA, P, "SUB-2", "subsystemRequirement", "Sub req 2", "");
        DmMocks.WorkItem tst1 = new DmMocks.WorkItem(sysTests, P, "TST-1", "testCase", "Test 1", "");
        DmMocks.WorkItem tst2 = new DmMocks.WorkItem(sysTests, P, "TST-2", "testCase", "Test 2", "");
        sub1.link("satisfies", sys1);
        sub2.link("satisfies", sys2).link("parent", sub1);
        tst1.link("verifies", sys1);
        tst2.link("verifies", sys2);
        sysH.link("parent", sys1);
        DmMocks.ITEMS.addAll(Arrays.asList(sys1, sys2, sysH, sub1, sub2, tst1, tst2));
        List<String> sample = Files.readAllLines(new File(root, "test-data/vcycle-model.yaml").toPath(), StandardCharsets.UTF_8);
        SAMPLE_LINES = sample.size();
        SPEC_LINE = sample.indexOf("    SystemSpec:") + 1;
        DmMocks.ITEMS.add(new DmMocks.WorkItem(modelDoc, P, "DM-1", "heading", "Data model", ""));
        DmMocks.ITEMS.add(new DmMocks.WorkItem(modelDoc, P, "DM-2", "text", "Introduction", "<span>This document holds the data model.</span><br/>"));
        DmMocks.ITEMS.add(new DmMocks.WorkItem(modelDoc, P, "DM-3", "text", "# Invented V-cycle data model", DmMocks.asStoredHtml(sample)));
        DmMocks.ITEMS.add(new DmMocks.WorkItem(errorsDoc, P, "DM-20", "text", "Errors", DmMocks.asStoredHtml(Arrays.asList(ERRORS_MODEL))));
        DmMocks.ITEMS.add(new DmMocks.WorkItem(syntaxDoc, P, "DM-30", "text", "Syntax", DmMocks.asStoredHtml(Arrays.asList(SYNTAX_MODEL))));
        DmMocks.ITEMS.add(new DmMocks.WorkItem(emptyDoc, P, "DM-40", "heading", "Nothing", ""));
        DmMocks.ITEMS.add(new DmMocks.WorkItem(pairedDoc, P, "DM-50", "text", "Paired", DmMocks.asStoredHtml(Arrays.asList(PAIRED_MODEL))));
        DmMocks.ITEMS.add(new DmMocks.WorkItem(pairErrDoc, P, "DM-60", "text", "Pair errors", DmMocks.asStoredHtml(Arrays.asList(PAIR_ERRORS_MODEL))));
        DmMocks.MODULES.add(new DmMocks.Module("SYSENG", "Tests", "Shared Tests", "Shared Tests"));
        // Shared models in another project (no document needed: read with getWorkItem, verified on 2512 by dmSpike S8).
        DmMocks.ITEMS.add(new DmMocks.WorkItem(null, "SYSENG", "SE-12", "text", "Shared model", DmMocks.asStoredHtml(sample)));
        DmMocks.ITEMS.add(new DmMocks.WorkItem(null, "SYSENG", "SE-13", "text", "Nested", DmMocks.asStoredHtml(Arrays.asList("version: 1", "uses: \"SYSENG/SE-12\""))));
        DmMocks.ITEMS.add(new DmMocks.WorkItem(null, "SYSENG", "SE-14", "text", "No model", DmMocks.asStoredHtml(Arrays.asList("version: 1", "name: nothing"))));
        DmMocks.ITEMS.add(new DmMocks.WorkItem(null, "SYSENG", "SE-15", "text", "Broken", DmMocks.asStoredHtml(Arrays.asList(
            "version: 1", "model:", "  roles:", "    A:", "      items:", "        - { type: text }", "     bad: indentation"))));
        String[][] uses = { { "uses", "SYSENG/SE-12" }, { "uses-nested", "SYSENG/SE-13" }, { "uses-missing", "NOPE/X-1" },
            { "uses-rev", "SYSENG/SE-12@100" }, { "uses-nomodel", "SYSENG/SE-14" }, { "uses-broken", "SYSENG/SE-15" } };
        for (String[] u : uses) {
            DmMocks.Module d = new DmMocks.Module(P, "Model", "Model " + u[0], "Model " + u[0]);
            DmMocks.MODULES.add(d);
            List<String> lines = new ArrayList<String>(Arrays.asList(USES_MODEL));
            lines.set(3, "uses: \"" + u[1] + "\"");
            if (!u[0].equals("uses")) { lines = lines.subList(0, 4); }
            DmMocks.ITEMS.add(new DmMocks.WorkItem(d, P, "DM-U-" + u[0], "text", "Uses", DmMocks.asStoredHtml(lines)));
            USES_DOCS.put(u[0], d);
        }
    }

    static Map<String, DmMocks.Param> params(DmMocks.Module doc, String itemId) {
        Map<String, DmMocks.Param> p = new HashMap<String, DmMocks.Param>();
        p.put("doc", new DmMocks.Param(doc == null ? null : new DmMocks.DocOpt(doc), null));
        p.put("itemTypes", new DmMocks.Param(null, new ArrayList<Object>(Arrays.asList(new DmMocks.Opt("text", "Text")))));
        p.put("itemId", new DmMocks.Param(itemId, null));
        p.put("height", new DmMocks.Param(Integer.valueOf(500), null));
        p.put("restSave", new DmMocks.Param("auto", null));
        return p;
    }

    static String run(String dir, String out, String name, Map<String, DmMocks.Param> p, boolean pdf) throws Exception {
        String html = DmMocks.render(dir, P, p, pdf, false, out + "/velocity-" + name + ".log");
        DmMocks.write(out + "/" + name + "-fragment.html", html);
        DmMocks.check(!Pattern.compile("(?<![A-Za-z0-9_])[$][!]?[{]?[a-zA-Z]").matcher(html).find(), name + ": no unrendered Velocity reference");
        DmMocks.check(!html.contains("#dm") && !html.contains("#dd"), name + ": no unexpanded macro");
        return html;
    }

    static int count(String html, String what) {
        int n = 0;
        for (int i = html.indexOf(what); i >= 0; i = html.indexOf(what, i + 1)) { n++; }
        return n;
    }

    /** Attributes of the roles, rules and problems of a rendered page (what the round trip must keep). */
    static List<String> modelOf(String html) {
        List<String> out = new ArrayList<String>();
        Matcher m = Pattern.compile("<i class=\"dm-[rlp]\"[^>]*>").matcher(html);
        while (m.find()) { out.add(m.group().replaceAll(" data-line=\"[0-9]*\"", "")); }
        return out;
    }

    /** Round trip (run by tools/test-widget.sh after the browser check): the YAML generated by the editor is read again
     *  by the server pipeline and must give the same roles, rules and pairs as the original model, with no problem. */
    /** The description HTML sent by Save to Polarion (captured by the browser check) is read by the pipeline as stored. */
    static void restRoundTrip(String dir, String out) throws Exception {
        File f = new File(out, "rest-patched.html");
        if (!f.exists()) { return; }
        String html = new String(Files.readAllBytes(f.toPath()), StandardCharsets.UTF_8);
        DmMocks.Module doc = new DmMocks.Module(P, "Model", "REST saved", "REST saved");
        DmMocks.MODULES.add(doc);
        DmMocks.ITEMS.add(new DmMocks.WorkItem(doc, P, "RT-rest", "text", "REST", html));
        String h = run(dir, out, "roundtrip-rest", params(doc, ""), false);
        String o = new String(Files.readAllBytes(new File(out, "browser-fragment.html").toPath()), StandardCharsets.UTF_8);
        DmMocks.check(count(h, "<i class=\"dm-p\"") == 0, "round trip REST: the HTML sent by Save to Polarion reads with no problem");
        List<String> a = modelOf(h), b = modelOf(o);
        // The saved text has a changed name: compare roles and rules only.
        DmMocks.check(a.equals(b), "round trip REST: same roles, rules and pairs");
        DmMocks.check(h.contains("data-name=\"V-cycle model (saved)\""), "round trip REST: the edited name is read back");
    }

    static void roundTrip(String dir, String out, String name, String yamlFile, String original) throws Exception {
        List<String> lines = Files.readAllLines(new File(yamlFile).toPath(), StandardCharsets.UTF_8);
        DmMocks.Module doc = new DmMocks.Module(P, "Model", "Round trip " + name, "Round trip");
        DmMocks.MODULES.add(doc);
        DmMocks.ITEMS.add(new DmMocks.WorkItem(doc, P, "RT-" + name, "text", "Round trip", DmMocks.asStoredHtml(lines)));
        String h = run(dir, out, "roundtrip-" + name, params(doc, ""), false);
        String o = new String(Files.readAllBytes(new File(out, original + "-fragment.html").toPath()), StandardCharsets.UTF_8);
        DmMocks.check(count(h, "<i class=\"dm-p\"") == 0, "round trip " + name + ": generated YAML reads with no problem");
        DmMocks.check(modelOf(h).equals(modelOf(o)), "round trip " + name + ": same roles, rules and pairs as the original model");
    }

    /** The model proposed by the starter generator (browser check) reads with no problem and has its roles and rules. */
    static void starterReadBack(String dir, String out, String yamlFile) throws Exception {
        List<String> lines = Files.readAllLines(new File(yamlFile).toPath(), StandardCharsets.UTF_8);
        DmMocks.Module doc = new DmMocks.Module(P, "Model", "Starter", "Starter");
        DmMocks.MODULES.add(doc);
        DmMocks.ITEMS.add(new DmMocks.WorkItem(doc, P, "RT-starter", "text", "Starter", DmMocks.asStoredHtml(lines)));
        String h = run(dir, out, "roundtrip-starter", params(doc, ""), false);
        DmMocks.check(count(h, "<i class=\"dm-p\"") == 0, "starter: the proposed model reads with no problem");
        DmMocks.check(count(h, "<i class=\"dm-r\"") == 3 && count(h, "<i class=\"dm-l\"") == 3, "starter: 3 roles, 3 rules");
    }

    public static void main(String[] args) throws Exception {
        if (args[0].equals("--roundtrip")) {
            buildTestSet(args[3]);
            roundTrip(args[1], args[2], "sample", args[2] + "/roundtrip.yaml", "browser");
            roundTrip(args[1], args[2], "paired", args[2] + "/roundtrip-paired.yaml", "paired");
            roundTrip(args[1], args[2], "uses", args[2] + "/roundtrip-uses.yaml", "uses");
            starterReadBack(args[1], args[2], args[2] + "/roundtrip-starter.yaml");
            restRoundTrip(args[1], args[2]);
            System.out.println("dmDefine round trip: all checks passed");
            return;
        }
        String dir = args[0];
        String out = args[1];
        buildTestSet(args[2]);
        new File(out).mkdirs();

        String h = run(dir, out, "browser", params(modelDoc, ""), false);
        DmMocks.check(h.contains("class=\"dd-root\"") && h.contains("data-item=\"DM-3\"") && h.contains("data-rev=\"4712\""), "valid: model item DM-3 found after a text item without model, revision from getLastRevision()");
        DmMocks.check(count(h, "<i class=\"dm-r\"") == 3, "valid: 3 roles");
        DmMocks.check(count(h, "<i class=\"dm-l\"") == 2, "valid: 2 link rules");
        DmMocks.check(count(h, "<i class=\"dm-p\"") == 0, "valid: no problem");
        DmMocks.check(h.contains("data-k=\"SubsystemReq\"") && h.contains("data-types=\"subsystemRequirement|1|-1|0;heading|-1|-1|1;\""), "valid: role types (flow maps, ignored)");
        DmMocks.check(h.contains("Specs/Subsystem A Requirements|DMTEST|Specs|Subsystem A Requirements|1|Subsystem A Requirements;"), "valid: declared document resolved");
        DmMocks.check(h.contains("data-id=\"L1\" data-from=\"SubsystemReq\" data-ft=\"subsystemRequirement\" data-role=\"satisfies\" data-rn=\"satisfies\" data-to=\"SystemSpec\" data-tt=\"systemRequirement\" data-fmin=\"1\" data-tmin=\"1\" data-sev=\"error\""), "valid: rule L1");
        DmMocks.check(h.contains("data-fmin=\"0\" data-tmin=\"1\" data-sev=\"warning\""), "valid: rule L2 defaults (from_min 0)");
        DmMocks.check(h.contains("data-unexp=\"warning\""), "valid: unexpected_links");
        DmMocks.check(h.contains("data-k=\"SystemSpec\" data-title=\"System specification\" data-line=\"" + SPEC_LINE + "\""), "valid: line numbers match the editor (an empty line counts once)");
        DmMocks.check(count(h, "<i class=\"dm-y\"") == SAMPLE_LINES, "valid: one text line per line of the sample model in the page model");
        DmMocks.check(h.contains("<script>") && h.contains("startWidgets('dd-root'"), "valid: script inlined");
        DmMocks.check(DmMocks.SQL_LOG.size() == 2 && DmMocks.SQL_LOG.get(0).contains(" OR ") && DmMocks.SQL_LOG.get(1).endsWith("WHERE p.c_id = 'DMTEST'"), "valid: one SQL query for the declared documents, one for the project documents (editor)");
        DmMocks.check(h.contains("<i class=\"dm-v\" data-p=\"model.roles.SubsystemReq.items[0].type\" data-k=\"scalar\" data-v=\"subsystemRequirement\""), "editor data: path maps in the page model");
        DmMocks.check(h.contains("data-p=\"model.roles\" data-k=\"map\" data-v=\"\" data-n=\"\" data-keys=\"SystemSpec;SubsystemReq;SystemTest;\""), "editor data: map keys in source order");
        DmMocks.check(h.contains("data-p=\"model.links\" data-k=\"list\" data-v=\"\" data-n=\"2\""), "editor data: list length");
        DmMocks.check(h.contains("<i class=\"dm-ct\" data-id=\"testCase\" data-n=\"Test Case\">") && h.contains("<i class=\"dm-cr\" data-id=\"satisfies\""), "editor data: project types and link roles");
        DmMocks.check(h.contains("<i class=\"dm-pd\" data-s=\"Specs\" data-n=\"Subsystem A Requirements\" data-t=\"Subsystem A Requirements\">"), "editor data: project documents");
        DmMocks.check(h.contains("data-errors=\"0\" data-text=\"1\""), "editor data: no error, model text present");

        h = run(dir, out, "byid", params(null, "DM-3"), false);
        DmMocks.check(h.contains("data-item=\"DM-3\"") && count(h, "<i class=\"dm-r\"") == 3, "id parameter: model read without document");

        h = run(dir, out, "errors", params(errorsDoc, ""), false);
        String[] expected = {
            "version: 2 is not known", "min is greater than max", "Work item type unknownType does not exist in project DMTEST",
            "unexpected_types must be error, warning or ignore (found: sometimes)", "Unknown key model.roles.SystemSpec.colour",
            "must be a whole number (found: x)", "Link role unknown_role does not exist", "role Nowhere is not defined in model.roles",
            "Rule id L1 is used twice", "type testCase is not listed in the items of role SystemSpec",
            "severity must be error, warning or info (found: fatal)", "model.links[1].to_severity must be error, warning or info (found: never)", "Document DMTEST/Specs/Missing Doc not found",
            "bindings: Other is not a role", "Role SubsystemReq has no document in bindings", "With uses:, the model comes from X/Y-1: remove the local model: part"
        };
        for (String e : expected) { DmMocks.check(h.contains(e), "errors: problem reported: " + e); }
        DmMocks.check(h.contains("data-sev=\"error\" data-line=\"8\" data-msg=\"model.roles.SystemSpec.items[0]: min is greater than max.\""), "errors: line number of a problem");
        DmMocks.check(h.contains("data-id=\"P1\" data-from=\"SystemSpec\"") && h.contains("data-rn=\"has parent\""), "errors: self rule kept, link role name from the configuration");

        h = run(dir, out, "syntax", params(syntaxDoc, ""), false);
        DmMocks.check(h.contains("data-line=\"6\" data-msg=\"Duplicate key model.roles.A.title\""), "syntax: duplicate key");
        DmMocks.check(h.contains("data-line=\"7\" data-msg=\"Unexpected indentation (3 spaces).\""), "syntax: indentation with line number");
        DmMocks.check(h.contains("Empty list entry") && h.contains("Nested [ ] or { }"), "syntax: empty dash, nested flow");

        h = run(dir, out, "pdf", params(modelDoc, ""), true);
        DmMocks.check(!h.contains("<script") && !h.contains("loadWidgetJs"), "PDF: no script");
        DmMocks.check(h.contains("No problem found in the model.") && h.contains("<td>SubsystemReq</td><td>Subsystem requirements</td><td>subsystemRequirement min 1, heading (ignored)</td>"), "PDF: roles table");
        DmMocks.check(h.contains("<td>L1</td><td>SubsystemReq / subsystemRequirement</td><td>satisfies</td><td>SystemSpec / systemRequirement</td><td>1</td><td>1</td><td>error</td>"), "PDF: rules table");
        h = run(dir, out, "pdf-errors", params(errorsDoc, ""), true);
        DmMocks.check(h.contains("<td class=\"dd-sev-error\">error</td><td>8</td>") && h.contains("(not found)"), "PDF errors: problems table, document not found");

        h = run(dir, out, "paired", params(pairedDoc, ""), false);
        DmMocks.check(count(h, "<i class=\"dm-p\"") == 0, "paired: valid pairs, no problem");
        DmMocks.check(h.contains("data-paired=\"1\" data-pairs=\"Tests/STD A|Specs/Solution Spec A;Tests/STD B|Specs/Solution Spec B;\" data-id=\"L2\""), "paired: pairs of L2 in the page model");
        DmMocks.check(h.contains("data-paired=\"0\" data-pairs=\"\" data-id=\"L1\""), "paired: L1 stays pooled");
        DmMocks.check(h.contains("data-sev=\"error\" data-fsev=\"info\" data-tsev=\"error\"") && h.contains("data-sev=\"error\" data-fsev=\"error\" data-tsev=\"error\""), "severity per side (D17): L1 sources info, L2 default");
        h = run(dir, out, "pdf-paired", params(pairedDoc, ""), true);
        DmMocks.check(h.contains("<td>paired: Tests/STD A -&gt; Specs/Solution Spec A; Tests/STD B -&gt; Specs/Solution Spec B</td>") && h.contains("<td> pooled</td>"), "PDF paired: documents column");
        DmMocks.check(h.contains("<td>error (sources: info, targets: error)</td>"), "PDF: severity per side in the rules table");

        h = run(dir, out, "pair-errors", params(pairErrDoc, ""), false);
        String[] pairExpected = {
            "data-sev=\"warning\" data-line=\"22\" data-msg=\"Pair [Tests/STD A, Specs/Solution Spec A] of V1 is listed twice.\"",
            "data-line=\"23\" data-msg=\"Pair of V1: Specs/Solution Spec B is not declared in bindings for role Test (source of the rule).\"",
            "data-line=\"23\" data-msg=\"Pair of V1: Tests/STD B is not declared in bindings for role Spec (target of the rule).\"",
            "data-line=\"24\" data-msg=\"pairs.V1[3] must be [source document, target document].\"",
            "data-line=\"25\" data-msg=\"pairs: V9 is not the id of a rule in model.links.\"",
            "Document DMTEST/Tests/STD B (role Test) is in no pair of rule V1: dmCheck will report it as unpaired.",
            "Document DMTEST/Specs/Solution Spec B (role Spec) is in no pair of rule V1: dmCheck will report it as unpaired."
        };
        for (String e : pairExpected) { DmMocks.check(h.contains(e), "pair errors: " + e); }
        DmMocks.check(count(h, "<i class=\"dm-p\"") == pairExpected.length, "pair errors: no other problem");

        h = run(dir, out, "uses", params(USES_DOCS.get("uses"), ""), false);
        DmMocks.check(count(h, "<i class=\"dm-p\"") == 0, "uses: no problem");
        DmMocks.check(count(h, "<i class=\"dm-r\"") == 3 && count(h, "<i class=\"dm-l\"") == 2, "uses: roles and rules of the referenced model");
        DmMocks.check(h.contains("data-uses=\"SYSENG/SE-12\"") && h.contains("data-uses-rev=\"4712\"") && h.contains("roles and rules from SYSENG/SE-12 (revision 4712)"), "uses: reference and revision shown");
        DmMocks.check(h.contains("data-k=\"SubsystemReq\"") && h.contains("Specs/Subsystem A Requirements|DMTEST|Specs|Subsystem A Requirements|1|"), "uses: local bindings");
        DmMocks.check(h.contains("SYSENG/Tests/Shared Tests|SYSENG|Tests|Shared Tests|1|Shared Tests;"), "cross-project document (project/space/name) resolved");
        DmMocks.check(count(h, "<i class=\"dm-y\"") == USES_MODEL.length, "uses: the model text is the local text");
        DmMocks.check(h.contains("data-p=\"model.roles.SystemSpec.items[0].type\"") && h.contains("data-p=\"uses\" data-k=\"scalar\" data-v=\"SYSENG/SE-12\""), "uses: editor data holds the merged model and uses");
        String[][] usesErr = {
            { "uses-nested", "The model of SYSENG/SE-13 itself uses another model: only one level of uses: is allowed." },
            { "uses-missing", "uses: work item NOPE/X-1 not found (or not readable)." },
            { "uses-rev", "uses: SYSENG/SE-12@100: a fixed revision (@) is not supported yet; write project/id." },
            { "uses-nomodel", "Work item SYSENG/SE-14 has no model: part (roles, links) in its description." },
            { "uses-broken", "data-line=\"0\" data-msg=\"Referenced model SYSENG/SE-15 line 7: Unexpected indentation (5 spaces).\"" } };
        for (String[] u : usesErr) {
            h = run(dir, out, u[0], params(USES_DOCS.get(u[0]), ""), false);
            DmMocks.check(h.contains(u[1]), u[0] + ": " + u[1]);
        }
        h = run(dir, out, "pdf-uses", params(USES_DOCS.get("uses"), ""), true);
        DmMocks.check(h.contains("roles and rules from SYSENG/SE-12") && h.contains("<td>SystemTest</td>"), "PDF uses: header and roles");

        Map<String, DmMocks.Param> off = params(modelDoc, "");
        off.put("restSave", new DmMocks.Param("off", null));
        h = run(dir, out, "restoff", off, false);
        DmMocks.check(h.contains("data-rest=\"off\""), "REST save switched off by the parameter");

        h = run(dir, out, "nodoc", params(null, ""), false);
        DmMocks.check(h.contains("No model document is selected") && h.contains("<script") && h.contains("data-text=\"0\""), "no document: interactive view (editor available), info problem");
        DmMocks.check(h.contains("<i class=\"dm-sd\" data-d=\"Specs/System Specification\" data-t=\"heading\"></i>") && h.contains("<i class=\"dm-sd\" data-d=\"Specs/System Specification\" data-t=\"systemRequirement\"></i>")
            && h.contains("<i class=\"dm-sl\" data-s=\"Specs/Subsystem A Requirements\" data-st=\"subsystemRequirement\" data-r=\"satisfies\" data-t=\"Specs/System Specification\" data-tt=\"systemRequirement\"></i>")
            && h.contains("data-r=\"parent\" data-t=\"Specs/Subsystem A Requirements\"") && count(h, "<i class=\"dm-sl\"") == 4, "starter data: types per document, 4 link combinations");
        h = run(dir, out, "browser-nostarter", params(modelDoc, ""), false);
        DmMocks.check(!h.contains("<i class=\"dm-sd\"") && !h.contains("<i class=\"dm-sl\""), "starter data: not read when a model exists");
        h = run(dir, out, "empty", params(emptyDoc, ""), false);
        DmMocks.check(h.contains("The model document has no work item of type [text]"), "empty document: problem reported");
        h = run(dir, out, "badid", params(null, "NOPE-1"), false);
        DmMocks.check(h.contains("Model item NOPE-1 not found in project DMTEST"), "wrong id: problem reported");
        System.out.println("dmDefine harness: all checks passed");
    }
}
