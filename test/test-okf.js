/*\
title: $:/plugins/rimir/okf/test/test-okf.js
type: application/javascript
tags: [[$:/tags/test-spec]]

Tests for the OKF mapping, driven through the rimir/frontmatter hooks.

\*/
"use strict";

var doc = require("$:/plugins/rimir/frontmatter/document.js");
var mapping = require("$:/plugins/rimir/okf/mapping.js");
var scope = require("$:/plugins/rimir/okf/scope.js");

var FILTER = "$:/config/rimir/okf/filter";

var SPEC_EXAMPLE = [
	"---",
	"type: Metric",
	"title: Monthly Revenue",
	"description: Revenue per month",
	"tags: [finance, revenue]",
	"resource: https://example.com/revenue",
	"status: stable",
	"stale_after: 2026-09-23T00:00:00Z",
	"generated: { by: reference_agent/gemini-2.5-pro, at: 2026-06-20T22:53:05Z }",
	"verified:",
	"  - { by: \"human:ahormati\", at: 2026-06-25T09:00:00Z }",
	"sources:",
	"  - id: ga4-schema",
	"    resource: https://developers.google.com/analytics/bigquery/export-schema",
	"    usage_count: 5000",
	"usage_window: { from: 2026-06-01T00:00:00Z, to: 2026-06-30T00:00:00Z }",
	"owner: team:finance",
	"x-custom: { a: 1, b: [x, y] }",
	"---",
	"# Revenue"
].join("\n");

function load(text, pathTitle, filepath) {
	return doc.parse(text, {}, {pathTitle: pathTitle, filepath: filepath});
}

function save(fields, pathTitle, filepath) {
	return doc.build(new $tw.Tiddler(fields), {pathTitle: pathTitle, fileInfo: {filepath: filepath || "/w/tiddlers/x.md"}});
}

function yamlOf(content) {
	return mapping.load(/^---\n([\s\S]*?)\n---\n/.exec(content)[1]);
}

describe("okf scope", function() {

	it("should tell TW content types from OKF concept types", function() {
		expect(scope.isTwType("text/markdown")).toBe(true);
		expect(scope.isTwType("text/x-frontmattered-markdown")).toBe(true);
		expect(scope.isOkfType("Metric")).toBe(true);
		expect(scope.isOkfType("data/table")).toBe(true);
		expect(scope.isOkfType("text/vnd.tiddlywiki")).toBe(false);
		expect(scope.isOkfType("")).toBe(false);
		expect(scope.isOkfType(undefined)).toBe(false);
	});

	it("should match everything with an empty filter", function() {
		expect(scope.matchesFilter({title: "A"}, "")).toBe(true);
	});

	it("should evaluate the filter against the single tiddler", function() {
		expect(scope.matchesFilter({title: "A", tags: "okf"}, "[tag[okf]]")).toBe(true);
		expect(scope.matchesFilter({title: "A"}, "[tag[okf]]")).toBe(false);
		expect(scope.matchesFilter({tags: "okf"}, "[tag[okf]]")).toBe(true);
	});
});

describe("okf load", function() {

	it("should map an OKF 0.2 document to tiddler fields", function() {
		var f = load(SPEC_EXAMPLE, "metrics/revenue");
		expect(f.title).toBe("metrics/revenue");
		expect(f.caption).toBe("Monthly Revenue");
		expect(f.type).toBe("text/markdown");
		expect(f["okf.type"]).toBe("Metric");
		expect(f.description).toBe("Revenue per month");
		expect(f.tags).toBe("finance revenue");
		expect(f["okf.resource"]).toBe("https://example.com/revenue");
		expect(f["okf.status"]).toBe("stable");
		expect(f["okf.stale_after"]).toBe("2026-09-23T00:00:00Z");
		expect(JSON.parse(f["okf.generated"])).toEqual({by: "reference_agent/gemini-2.5-pro", at: "2026-06-20T22:53:05Z"});
		expect(JSON.parse(f["okf.verified"])).toEqual([{by: "human:ahormati", at: "2026-06-25T09:00:00Z"}]);
		expect(JSON.parse(f["okf.sources"])[0].usage_count).toBe("5000");
		expect(JSON.parse(f["okf.usage_window"]).to).toBe("2026-06-30T00:00:00Z");
		expect(f.owner).toBe("team:finance");
		expect(f["okf.extra"]).toContain("x-custom");
		expect(f.text).toBe("# Revenue");
		// Nothing from the flat frontmatter parse is left behind
		expect(f.by).toBeUndefined();
		expect(f.generated).toBeUndefined();
	});

	it("should not create okf.type for the default type", function() {
		var f = load("---\ntype: tiddler\ntitle: Note\n---\nx", "note");
		expect(f["okf.type"]).toBeUndefined();
		expect(f.caption).toBe("Note");
	});

	it("should take the tiddler title from tw.title", function() {
		var f = load("---\ntype: Note\ntitle: Display\ntw.title: \"a:b\"\n---\nx", "a_b");
		expect(f.title).toBe("a:b");
		expect(f.caption).toBe("Display");
	});

	it("should read a file written by frontmatter (no type) with title as tiddler title", function() {
		var f = load("---\ntitle: \"work/x:y\"\ncaption: Cap\ncreated: 20250101120000000\ntags:\n  - A\n  - B C\n---\nBody", "work/x_y");
		expect(f.title).toBe("work/x:y");
		expect(f.caption).toBe("Cap");
		expect(f.created).toBe("20250101120000000");
		expect(f.tags).toBe("A [[B C]]");
		expect(f.type).toBe("text/markdown");
		expect(f["okf.type"]).toBeUndefined();
	});

	it("should treat a markdown TW type in the YAML as a frontmatter file", function() {
		var f = load("---\ntitle: T\ntype: text/markdown\n---\nx", "t");
		expect(f.title).toBe("T");
		expect(f["okf.type"]).toBeUndefined();
	});

	it("should leave invalid YAML to the frontmatter parse", function() {
		var f = load("---\ntitle: T\nbad: [unclosed\n---\nx", "t");
		expect(f.title).toBe("T");
		expect(f.type).toBe(doc.DEFAULT_TYPE);
	});
});

describe("okf save", function() {

	it("should write the type, the caption as title and no TW type", function() {
		var y = yamlOf(save({title: "notes/a", caption: "A", type: "text/markdown", text: "x"}, "notes/a"));
		expect(y.type).toBe("tiddler");
		expect(y.title).toBe("A");
		expect(y["tw.title"]).toBeUndefined();
	});

	it("should write tw.title only when the path can't reproduce the title", function() {
		var y = yamlOf(save({title: "a:b", type: "text/markdown"}, "a_b"));
		expect(y["tw.title"]).toBe("a:b");
		expect(y.title).toBeUndefined();
	});

	it("should write dates as ISO 8601 and read them back exactly", function() {
		var content = save({title: "d", type: "text/markdown", created: "20260102030405006"}, "d");
		expect(yamlOf(content).created).toBe("2026-01-02T03:04:05.006Z");
		expect(load(content, "d").created).toBe("20260102030405006");
	});

	it("should not write a default type for index.md and log.md", function() {
		expect(yamlOf(save({title: "index", type: "text/markdown", caption: "I"}, "index", "/w/tiddlers/index.md")).type).toBeUndefined();
		expect(yamlOf(save({title: "sub/log", type: "text/markdown", caption: "L"}, "sub/log", "/w/tiddlers/sub/log.md")).type).toBeUndefined();
	});

	it("should round-trip an OKF 0.2 document without losing keys", function() {
		var original = yamlOf(SPEC_EXAMPLE + "\n");
		var fields = load(SPEC_EXAMPLE, "metrics/revenue");
		var written = save(fields, "metrics/revenue");
		expect(yamlOf(written)).toEqual(original);
		expect(written).toMatch(/\n---\n# Revenue$/);
		// Second cycle is stable
		expect(save(load(written, "metrics/revenue"), "metrics/revenue")).toBe(written);
	});
});

describe("okf filter", function() {

	beforeEach(function() {
		$tw.wiki.addTiddler({title: FILTER, text: "[tag[okf]]"});
	});

	afterEach(function() {
		$tw.wiki.deleteTiddler(FILTER);
	});

	it("should always handle files with an OKF type (safety rule)", function() {
		expect(load(SPEC_EXAMPLE, "metrics/revenue")["okf.type"]).toBe("Metric");
	});

	it("should leave frontmatter files outside the filter alone", function() {
		var f = load("---\ntitle: T\n---\nx", "t");
		expect(f.type).toBe(doc.DEFAULT_TYPE);
	});

	it("should handle frontmatter files matching the filter", function() {
		var f = load("---\ntitle: T\ntags:\n  - okf\n---\nx", "t");
		expect(f.type).toBe("text/markdown");
	});

	it("should save tiddlers outside the filter as plain frontmatter", function() {
		var y = yamlOf(save({title: "t", type: "text/markdown"}, "t"));
		expect(y.type).toBe("text/markdown");
	});

	it("should save tiddlers with an okf.type as OKF regardless of the filter", function() {
		var y = yamlOf(save({title: "t", type: "text/markdown", "okf.type": "Playbook"}, "t"));
		expect(y.type).toBe("Playbook");
	});
});

if($tw.node) {

	describe("okf file paths", function() {

		var fs = require("fs"),
			os = require("os"),
			path = require("path"),
			dir;

		beforeEach(function() {
			dir = fs.mkdtempSync(path.join(os.tmpdir(), "okf-path-"));
		});

		afterEach(function() {
			fs.rmSync(dir, {recursive: true, force: true});
		});

		function fileInfoFor(fields, existing) {
			var tiddler = new $tw.Tiddler(fields);
			return $tw.utils.generateTiddlerFileInfo(tiddler, {directory: dir, wiki: $tw.wiki, fileInfo: existing});
		}

		it("should create new OKF files at <title>.md with folders", function() {
			expect(fileInfoFor({title: "metrics/revenue", type: "text/markdown"}).filepath).toBe(path.join(dir, "metrics", "revenue.md"));
		});

		it("should keep an existing .md file where it is", function() {
			var existing = {filepath: path.join(dir, "elsewhere", "rev.md"), type: "text/markdown", hasMetaFile: false};
			expect(fileInfoFor({title: "metrics/revenue", type: "text/markdown"}, existing).filepath).toBe(existing.filepath);
		});

		it("should leave non-OKF tiddlers to frontmatter's path rules", function() {
			$tw.wiki.addTiddler({title: FILTER, text: "[tag[okf]]"});
			try {
				expect(fileInfoFor({title: "metrics/revenue", type: "text/markdown"}).filepath).toBe(path.join(dir, "metrics_revenue.md"));
			} finally {
				$tw.wiki.deleteTiddler(FILTER);
			}
		});
	});
}
