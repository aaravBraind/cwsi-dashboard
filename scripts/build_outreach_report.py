#!/usr/bin/env python3
"""Build the CWSI Outreach performance report (.docx) from a JSON data payload.

    python3 scripts/build_outreach_report.py <data.json> [-o out.docx]

The delivered June report is used as the TEMPLATE: everything except word/document.xml
is copied across, so the CWSI logo, headers, footers, fonts and table styles are the
same file's, not a reconstruction. Only the body is regenerated.

The JSON payload comes from the v_outreach_report_* views (see
supabase/migrations/20260730000000_outreach_report_layer.sql). Because those views are
built on individual mailings rather than Outreach's lifetime counters, the same script
generates an all-time report or any window — the payload just carries a different
`period_label`.
"""
import argparse
import json
import re
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TEMPLATE = ROOT / "docs" / "CWSI_Outreach_Report_BraindAI.docx"

# Palette lifted from the delivered document so the two read as one series.
INK, MUTED, BRAND, DARK = "22262f", "5b6577", "1032c7", "0a0b3c"
HEAD_TEXT, RULE = "dce3f7", "e1e5ee"


class Xml(str):
    """Already-rendered markup. Marks it as not needing escaping or re-wrapping."""


def esc(t):
    return (str(t).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


def run(text, *, size=19, bold=False, italic=False, colour=INK):
    return Xml(
        '<w:r><w:rPr><w:rFonts w:ascii="Arial" w:cs="Arial" w:eastAsia="Arial" w:hAnsi="Arial"/>'
        f'<w:b w:val="{int(bold)}"/><w:bCs w:val="{int(bold)}"/>'
        f'<w:i w:val="{int(italic)}"/><w:iCs w:val="{int(italic)}"/>'
        f'<w:color w:val="{colour}"/><w:sz w:val="{size}"/><w:szCs w:val="{size}"/>'
        f'<w:rtl w:val="0"/></w:rPr><w:t xml:space="preserve">{esc(text)}</w:t></w:r>'
    )


def para(runs, *, after=120, align="left", rule=False, indent=None):
    if not isinstance(runs, Xml):   # plain text -> default body run
        runs = run(runs)
    bdr = (f'<w:pBdr><w:bottom w:color="{RULE}" w:space="2" w:sz="6" w:val="single"/></w:pBdr>'
           if rule else "")
    ind = f'<w:ind w:left="{indent}"/>' if indent else ""
    return (f'<w:p><w:pPr>{bdr}<w:spacing w:after="{after}" w:lineRule="auto"/>{ind}'
            f'<w:jc w:val="{align}"/><w:rPr/></w:pPr>{runs}</w:p>')


def heading(text):
    return para(run(text, size=26, bold=True, colour=DARK), after=100)


def note(text):
    """The small grey line under a table. This is where definitions live."""
    return para(run(text, size=16, italic=True, colour=MUTED), after=200)


def bullet(text):
    return para(run("•   " + text), after=60, indent=200)


def cell(text, *, header=False, numeric=False, shade=None, bold=False):
    fill = shade or (DARK if header else None)
    shd = f'<w:shd w:fill="{fill}" w:val="clear"/>' if fill else ""
    colour = HEAD_TEXT if header else INK
    size = 16 if header else 17
    align = "right" if numeric else "left"
    body = (f'<w:p><w:pPr><w:spacing w:after="0" w:lineRule="auto"/>'
            f'<w:jc w:val="{align}"/><w:rPr/></w:pPr>'
            f'{run(text, size=size, bold=header or bold, colour=colour)}</w:p>')
    return (
        '<w:tc><w:tcPr><w:tcBorders>'
        + "".join(f'<w:{e} w:color="{RULE}" w:space="0" w:sz="4" w:val="single"/>'
                  for e in ("top", "left", "bottom", "right"))
        + f'</w:tcBorders>{shd}'
        + '<w:tcMar><w:top w:w="60.0" w:type="dxa"/><w:left w:w="120.0" w:type="dxa"/>'
          '<w:bottom w:w="60.0" w:type="dxa"/><w:right w:w="120.0" w:type="dxa"/></w:tcMar>'
          '<w:vAlign w:val="center"/></w:tcPr>' + body + '</w:tc>'
    )


def table(headers, rows, widths, style="Table1", total_row=None):
    """rows: list of lists. First column is text, the rest render right-aligned."""
    grid = "".join(f'<w:gridCol w:w="{w}"/>' for w in widths)
    out = [
        f'<w:tbl><w:tblPr><w:tblStyle w:val="{style}"/>'
        f'<w:tblW w:w="{sum(widths)}.0" w:type="dxa"/><w:jc w:val="left"/><w:tblBorders>'
        + "".join(f'<w:{e} w:color="{RULE}" w:space="0" w:sz="2" w:val="single"/>'
                  for e in ("top", "left", "bottom", "right", "insideH", "insideV"))
        + '</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblLook w:val="0000"/></w:tblPr>'
          f'<w:tblGrid>{grid}</w:tblGrid>'
    ]
    out.append('<w:tr><w:trPr><w:cantSplit w:val="0"/><w:tblHeader w:val="1"/></w:trPr>'
               + "".join(cell(h, header=True, numeric=i > 0)
                         for i, h in enumerate(headers)) + '</w:tr>')
    for r in rows:
        out.append('<w:tr><w:trPr><w:cantSplit w:val="0"/><w:tblHeader w:val="0"/></w:trPr>'
                   + "".join(cell(v, numeric=i > 0) for i, v in enumerate(r)) + '</w:tr>')
    if total_row:
        out.append('<w:tr><w:trPr><w:cantSplit w:val="0"/><w:tblHeader w:val="0"/></w:trPr>'
                   + "".join(cell(v, numeric=i > 0, shade="f2f5fc", bold=True)
                             for i, v in enumerate(total_row)) + '</w:tr>')
    out.append('</w:tbl>')
    # Word needs a paragraph after a table or consecutive tables merge.
    out.append(para("", after=0))
    return "".join(out)


def n(v):
    return "0" if v in (None, "") else f"{int(v):,}"


def pct(v):
    return "–" if v in (None, "") else f"{float(v):.1f}%"


# --------------------------------------------------------------------------- body
def build_body(d, logo_para, sectpr):
    seq_count = d["sequence_count"]
    p = [logo_para]
    p.append(para(run("CWSI Outreach: Performance Report", size=52, bold=True, colour=BRAND),
                  after=40))
    p.append(para(run(f'{d["period_label"]}   |   {d["as_of"]}   |   {seq_count} CWSI sequences',
                      size=19, italic=True, colour=MUTED), after=60))
    p.append(para("", after=160, rule=True))

    # 1. Overview -----------------------------------------------------------
    p.append(heading("1. Overview"))
    first_list_sec = 7 if d.get("by_step") else 6   # keep in step with the section numbering below
    p.append(para(
        f'This report covers every CWSI outreach sequence across the three programmes '
        f'— Secure Outbound, Microsoft and SoPro — for {d["period_sentence"]}. '
        f'All {seq_count} sequences are listed individually in sections {first_list_sec} to '
        f'{first_list_sec + 2}, including those that have not started sending yet.'))
    p.append(para(run("What this report shows", size=20, bold=True, colour=DARK), after=60))
    for b in ("Performance by seller, by programme and by region",
              "How far prospects get through each sequence, step by step",
              f"A full breakdown of all {seq_count} sequences, one by one",
              "Meetings booked, credited back to the sequence that generated them"):
        p.append(bullet(b))
    p.append(para("", after=120))

    # 2. How to read the figures — the definitions block ---------------------
    p.append(heading("2. How to read the figures"))
    p.append(para(
        "Two columns in this report are counted in different units, and comparing them "
        "directly is misleading, so it is worth being explicit:"))
    for b in (
        "Assigned counts prospects. It is the number of people registered to a sequence.",
        "Sent counts emails. A sequence with four steps sends up to four emails to each "
        "prospect, so Sent is routinely larger than Assigned. The two are not comparable "
        "and a higher Sent figure does not mean more people were reached.",
        "Prospects emailed is the like-for-like figure: how many individual people "
        "received at least one email. Every rate in this report is calculated on this, "
        "never on Assigned.",
        "Opens and Replies count people, not events — one prospect who opens the same "
        "email six times counts once. Raw open events are shown as a separate column so "
        "the two are never conflated.",
    ):
        p.append(bullet(b))
    p.append(note(
        "Assigned reflects prospects currently registered to a sequence. Outreach removes "
        "the record when a prospect is taken off a sequence, so a prospect who was emailed "
        "and later removed still appears under Sent but no longer under Assigned."))

    # 3. Seller -------------------------------------------------------------
    p.append(heading("3. Performance by seller"))
    hdr = ["Seller", "Region", "Assigned", "Sent", "Prospects emailed", "Opens",
           "Open events", "Replies", "Reply rate", "Meetings"]
    w = [1180, 780, 900, 760, 1120, 760, 940, 800, 940, 900]
    rows = [[r["seller"] or "Unassigned", r.get("region_code") or "–", n(r["assigned"]),
             n(r["sent"]), n(r["prospects_emailed"]), n(r["opens"]), n(r["open_events"]),
             n(r["replies"]), pct(r["reply_rate_pct"]), n(r.get("meetings"))]
            for r in d["by_seller"]]
    t = d["totals"]
    p.append(table(hdr, rows, w, style="Table1", total_row=[
        "Total", "–", n(t["assigned"]), n(t["sent"]), n(t["prospects_emailed"]),
        n(t["opens"]), n(t["open_events"]), n(t["replies"]), pct(t["reply_rate_pct"]),
        n(t["meetings"])]))
    p.append(note("Opens and Replies are counts of individual prospects. Reply rate is "
                  "replies divided by prospects emailed."))

    # 4. Programme ----------------------------------------------------------
    p.append(heading("4. Performance by programme"))
    hdr = ["Programme", "Sequences", "Sending", "Assigned", "Sent", "Prospects emailed",
           "Opens", "Replies", "Reply rate", "Meetings"]
    w = [1360, 900, 800, 900, 760, 1120, 760, 800, 900, 860]
    rows = [[r["programme"] or "Other", n(r["sequences"]), n(r["sequences_sending"]),
             n(r["assigned"]), n(r["sent"]), n(r["prospects_emailed"]), n(r["opens"]),
             n(r["replies"]), pct(r["reply_rate_pct"]), n(r.get("meetings"))]
            for r in d["by_programme"]]
    p.append(table(hdr, rows, w, style="Table2", total_row=[
        "Total", n(seq_count), n(t["sequences_sending"]), n(t["assigned"]), n(t["sent"]),
        n(t["prospects_emailed"]), n(t["opens"]), n(t["replies"]),
        pct(t["reply_rate_pct"]), n(t["meetings"])]))
    p.append(note("Sending counts sequences that have delivered at least one email. The "
                  "difference between Sequences and Sending is the sequences that are built "
                  "and loaded but not yet started."))

    # 5. Region -------------------------------------------------------------
    p.append(heading("5. Performance by region"))
    hdr = ["Region", "Sequences", "Assigned", "Sent", "Prospects emailed", "Opens",
           "Replies", "Reply rate", "Meetings"]
    w = [1180, 940, 940, 820, 1160, 820, 860, 960, 940]
    rows = [[r["region_code"] or "Unassigned", n(r["sequences"]), n(r["assigned"]),
             n(r["sent"]), n(r["prospects_emailed"]), n(r["opens"]), n(r["replies"]),
             pct(r["reply_rate_pct"]), n(r.get("meetings"))] for r in d["by_region"]]
    p.append(table(hdr, rows, w, style="Table3", total_row=[
        "Total", n(seq_count), n(t["assigned"]), n(t["sent"]), n(t["prospects_emailed"]),
        n(t["opens"]), n(t["replies"]), pct(t["reply_rate_pct"]), n(t["meetings"])]))
    if d.get("region_note"):
        p.append(note(d["region_note"]))

    # 6. Step drop-off ------------------------------------------------------
    if d.get("by_step"):
        p.append(heading("6. How far prospects get through a sequence"))
        p.append(para(
            "Each sequence is a series of steps. This shows where prospects stop engaging, "
            "which is what tells us whether the first email is working and whether the "
            "follow-ups are worth sending."))
        hdr = ["Programme", "Step", "Type", "Sent", "Opens", "Replies"]
        w = [2000, 900, 1600, 1620, 1620, 1620]
        rows = [[r["programme"] or "Other", n(r["step_order"]), r.get("step_type") or "–",
                 n(r["sent"]), n(r["opens"]), n(r["replies"])] for r in d["by_step"]]
        p.append(table(hdr, rows, w, style="Table4"))
        p.append(note("Sent counts emails at that step; Opens and Replies count individual "
                      "prospects who engaged at that step."))

    # 7-9. Full sequence lists ---------------------------------------------
    sec = 7 if d.get("by_step") else 6
    for prog in ("Secure Outbound", "Microsoft", "SoPro"):
        seqs = [r for r in d["by_sequence"] if (r["programme"] or "Other") == prog]
        if not seqs:
            continue
        plural = "sequence" if len(seqs) == 1 else "sequences"
        p.append(heading(f"{sec}. {prog}: all {len(seqs)} {plural}"))
        hdr = ["Sequence", "Assigned", "Sent", "Prospects emailed", "Opens", "Replies",
               "Reply rate", "Meetings"]
        w = [3100, 820, 720, 1120, 720, 760, 900, 820]
        rows = [[r["sequence_name"], n(r["assigned"]), n(r["sent"]),
                 n(r["prospects_emailed"]), n(r["opens"]), n(r["replies"]),
                 pct(r["reply_rate_pct"]), n(r.get("meetings"))] for r in seqs]
        p.append(table(hdr, rows, w, style="Table5" if sec % 2 else "Table6"))
        p.append(note("A 0 in Sent means the sequence is built and prospects are loaded, "
                      "but sending has not started."))
        sec += 1

    # Meetings --------------------------------------------------------------
    p.append(heading(f"{sec}. Meetings booked"))
    p.append(para(d["meetings_narrative"]))
    if d.get("meetings_detail"):
        hdr = ["Date", "Sequence", "Programme", "Region", "Seller"]
        w = [1200, 3400, 1600, 1080, 2080]
        rows = [[m["activity_date"], m["sequence_name"], m.get("programme") or "–",
                 m.get("region_code") or "–", m.get("seller") or "–"]
                for m in d["meetings_detail"]]
        p.append(table(hdr, rows, w, style="Table6"))
    p.append(note(
        "Outreach's API does not expose meetings, so meetings are taken from Salesforce and "
        "credited to a sequence when the meeting's contact is a prospect on that sequence. "
        "Only meetings carrying a contact email can be matched, so this figure reads low "
        "rather than high."))

    p.append(para(run(f'Prepared by Braind AI  |  Source: Outreach and Salesforce  |  '
                      f'{d["as_of"]}', size=15, italic=True, colour=MUTED), after=0))
    return "".join(p) + sectpr


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("data", help="JSON payload from the v_outreach_report_* views")
    ap.add_argument("-o", "--out", default=str(ROOT / "docs" / "CWSI_Outreach_Report_AllTime.docx"))
    ap.add_argument("--template", default=str(TEMPLATE))
    a = ap.parse_args()

    d = json.loads(Path(a.data).read_text())
    src = zipfile.ZipFile(a.template)
    doc = src.read("word/document.xml").decode("utf8")

    # Reuse the template's own logo paragraph and section properties verbatim, so the
    # image relationship id and the header/footer references stay valid.
    logo = re.search(r"<w:p [^>]*?>(?:(?!</w:p>).)*?<w:drawing>.*?</w:p>", doc, re.S)
    sectpr = re.search(r"<w:sectPr>.*?</w:sectPr>", doc, re.S)
    if not logo or not sectpr:
        raise SystemExit("template does not look like the delivered report")

    head = doc[: doc.index("<w:body>") + len("<w:body>")]
    new = head + build_body(d, logo.group(0), sectpr.group(0)) + "</w:body></w:document>"

    out = Path(a.out)
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for item in src.infolist():
            if item.filename == "word/document.xml":
                z.writestr(item, new)
            else:
                z.writestr(item, src.read(item.filename))
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
