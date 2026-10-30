#!/usr/bin/env python3
"""Runs the drill-down queries of dmCheck (page model <i class="dc-q">, dmCheck 0.2) on an SQLite copy of the test
structure test-data/vcycle-check/structure.md and checks that each query lists exactly the items that the Velocity
evaluation reported for the same rule, check and document (<i class="dc-v">), and as many as its count (data-n).

It checks the SQL text and its meaning on the tables the queries use (workitem, module, project,
struct_workitem_linkedworkitems, with the columns verified on 2512), NOT Polarion's SQL engine: the query form itself was
verified on 2512 by dmSpike S10 (runs 5 and 5b).
Usage: sql-check.py <outDir> <repoRoot>
"""
import glob
import html
import os
import re
import sqlite3
import sys

P = "DMTEST"  # project id of the harness (tools/vtest/dmCheck/CheckHarness.java)


def table(lines, heading):
    rows, on = [], False
    for line in lines:
        if line.startswith(heading):
            on = True
            continue
        if on and line.startswith("## "):
            break
        t = line.strip()
        if not on or not t.startswith("|") or t.startswith("|---") or t.startswith("| Document"):
            continue
        rows.append([c.strip() for c in t[1:-1].split("|")])
    return rows


def build_db(root):
    lines = open(os.path.join(root, "test-data/vcycle-check/structure.md"), encoding="utf-8").read().splitlines()
    db = sqlite3.connect(":memory:")
    c = db.cursor()
    c.execute("CREATE TABLE project (c_uri TEXT, c_id TEXT)")
    c.execute("CREATE TABLE module (c_uri TEXT, fk_uri_project TEXT, c_modulefolder TEXT, c_id TEXT)")
    c.execute("CREATE TABLE workitem (c_uri TEXT, fk_uri_module TEXT, c_type TEXT, c_id TEXT)")
    c.execute("CREATE TABLE struct_workitem_linkedworkitems (fk_uri_p_workitem TEXT, fk_uri_workitem TEXT, c_role TEXT)")
    c.execute("INSERT INTO project VALUES (?, ?)", ("p:" + P, P))
    doc, links = None, []
    for r in table(lines, "## Documents and items"):
        if r[0]:
            doc = r[0]
            space, name = doc.split("/", 1)
            c.execute("INSERT INTO module VALUES (?, ?, ?, ?)", ("m:" + doc, "p:" + P, space, name))
        c.execute("INSERT INTO workitem VALUES (?, ?, ?, ?)", ("w:" + r[1], "m:" + doc, r[2], r[1]))
        for part in r[3].split(";"):
            f = part.split()
            if len(f) == 2:
                links.append(("w:" + r[1], "w:" + f[1], f[0]))
    c.executemany("INSERT INTO struct_workitem_linkedworkitems VALUES (?, ?, ?)", links)
    return db


def attrs(tag):
    return {k: html.unescape(v) for k, v in re.findall(r'data-([a-z0-9]+)="([^"]*)"', tag)}


def main():
    out, root = sys.argv[1], sys.argv[2]
    db = build_db(root)
    failed, checked = 0, 0
    for f in sorted(glob.glob(os.path.join(out, "*-fragment.html"))):
        page = open(f, encoding="utf-8").read()
        qs = [attrs(t) for t in re.findall(r'<i class="dc-q"[^>]*>', page)]
        if not qs:
            continue
        viol = [attrs(t) for t in re.findall(r'<i class="dc-v"[^>]*>', page)]
        for q in qs:
            m = re.match(r"project\.id:(\S+) AND SQL:\((.*)\)\Z", q["q"], re.S)
            name = "%s: %s %s %s" % (os.path.basename(f), q["rule"], q["kind"], q["doc"])
            if not m or m.group(1) != P:
                print("FAIL %s: not a 'project.id:%s AND SQL:(...)' query: %s" % (name, P, q["q"]))
                failed += 1
                continue
            try:
                got = {r[0][2:] for r in db.execute(m.group(2)).fetchall()}
            except sqlite3.Error as e:
                print("FAIL %s: SQL error %s in %s" % (name, e, m.group(2)))
                failed += 1
                continue
            want = {v["item"].split("/", 1)[1] for v in viol
                    if v["rule"] == q["rule"] and v["kind"] == q["kind"] and v["doc"] == q["doc"] and v["item"]}
            checked += 1
            # With a list cap (listCap parameter) only part of the violations is listed: those must be in the result.
            listed_all = len(want) == int(q["n"])
            if len(got) != int(q["n"]) or (got != want if listed_all else not want <= got):
                print("FAIL %s: query gives %s, evaluation %s, count %s" % (name, sorted(got), sorted(want), q["n"]))
                failed += 1
    if checked == 0:
        print("FAIL no drill-down query found")
        failed += 1
    print("%s drill-down queries: %d run on SQLite, %d failed" % ("OK  " if not failed else "FAIL", checked, failed))
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
