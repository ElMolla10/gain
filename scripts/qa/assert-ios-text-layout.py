#!/usr/bin/env python3
"""Assert real Maestro native bounds for a known text-size QA fixture.

Example: Plan title 'QA Full Body Plan' on SE3 at accessibility-large must
wrap to multiple lines (at least 100pt high), within the 375pt viewport.
This reads captured evidence; it never operates a device or changes data.
"""
import argparse
import json
import re


def nodes(value):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from nodes(child)
    elif isinstance(value, list):
        for child in value:
            yield from nodes(child)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("hierarchy")
    parser.add_argument("--text", required=True)
    parser.add_argument("--min-height", type=int, required=True)
    parser.add_argument("--screen-width", type=int, required=True)
    args = parser.parse_args()
    with open(args.hierarchy, encoding="utf-8") as source:
        tree = json.load(source)
    matches = set()
    for node in nodes(tree):
        attrs = node.get("attributes", {})
        label = attrs.get("accessibilityText") or attrs.get("text", "")
        if label == args.text:
            match = re.fullmatch(r"\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]", attrs.get("bounds", ""))
            if match:
                matches.add(tuple(map(int, match.groups())))
    matches = sorted(matches)  # iOS can expose identical heading/text accessibility nodes.
    assert len(matches) == 1, f"Expected exactly one fixture title, found {matches}"
    left, top, right, bottom = matches[0]
    assert bottom - top >= args.min_height, f"Stale text height: {bottom - top}pt < {args.min_height}pt; bounds={matches[0]}"
    assert 0 <= left < right <= args.screen_width, f"Text exceeds viewport: {matches[0]}"
    print(json.dumps({"text": args.text, "bounds": matches[0], "result": "PASS"}))


if __name__ == "__main__":
    main()
