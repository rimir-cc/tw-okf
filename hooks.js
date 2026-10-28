/*\
title: $:/plugins/rimir/okf/hooks.js
type: application/javascript
module-type: library

Implementations of the rimir/frontmatter extension hooks:
th-frontmatter-parse, th-frontmatter-serialize and th-frontmatter-fileinfo.

\*/

"use strict";

var mapping = require("$:/plugins/rimir/okf/mapping.js");
var scope = require("$:/plugins/rimir/okf/scope.js");

var CONFIG = {
	filter: "$:/config/rimir/okf/filter",
	defaultType: "$:/config/rimir/okf/default-type",
	tiddlerType: "$:/config/rimir/okf/tiddler-type"
};
var RESERVED_RE = /(^|[\/\\])(index|log)\.md$/;

function config(name, fallback) {
	return ($tw.wiki.getTiddlerText(CONFIG[name]) || "").trim() || fallback;
}

function warn(message) {
	new $tw.utils.Logger("okf", {colour: "magenta"}).log(message);
}

exports.onParse = function(fields, info) {
	var data;
	try {
		data = mapping.load(info.yaml);
	} catch(e) {
		warn("Invalid YAML" + (info.filepath ? " in " + info.filepath : "") + ", kept frontmatter parse: " + e.message);
		return fields;
	}
	if(!data) {
		return fields;
	}
	var mapped = mapping.fromOkf(data, {
		body: info.body,
		pathTitle: info.pathTitle,
		defaultType: config("defaultType", "tiddler"),
		tiddlerType: config("tiddlerType", "text/markdown")
	});
	if(!scope.isOkfType(data.type) && !scope.matchesFilter(mapped, config("filter", ""))) {
		return fields;
	}
	// Replace what the flat parse produced; keep fields preset by the caller
	$tw.utils.each(info.parsed, function(value, key) {
		delete fields[key];
	});
	delete fields.type;
	return $tw.utils.extend(fields, mapped);
};

// A tiddler with an OKF type is always OKF; otherwise the filter decides
function isOkfTiddler(tiddler) {
	return scope.isOkfType(tiddler.fields["okf.type"]) || scope.matchesFilter(tiddler, config("filter", ""));
}

exports.onSerialize = function(yamlText, tiddler, info) {
	if(!isOkfTiddler(tiddler)) {
		return yamlText;
	}
	var filepath = info.fileInfo && info.fileInfo.filepath;
	return mapping.dump(mapping.toOkf(tiddler, {
		pathTitle: info.pathTitle,
		defaultType: config("defaultType", "tiddler"),
		reserved: !!(filepath && RESERVED_RE.test(filepath))
	}));
};

// The file path is the OKF concept ID: keep an existing .md where it is, and
// create new files at <title>.md with `/` as folders
exports.onFileInfo = function(fileInfo, tiddler, options) {
	if(!isOkfTiddler(tiddler)) {
		return fileInfo;
	}
	var path = require("path"),
		existing = options.fileInfo && options.fileInfo.filepath;
	if(existing && path.extname(existing) === ".md") {
		fileInfo.filepath = existing;
	} else if(options.directory) {
		fileInfo.filepath = $tw.utils.generateTiddlerFilepath(tiddler.fields.title, {
			directory: options.directory,
			extension: ".md",
			pathFilters: ["[!is[blank]]"],
			wiki: options.wiki || $tw.wiki,
			fileInfo: options.fileInfo
		});
	}
	return fileInfo;
};
