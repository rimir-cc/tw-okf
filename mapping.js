/*\
title: $:/plugins/rimir/okf/mapping.js
type: application/javascript
module-type: library

Maps between OKF frontmatter (a parsed YAML object) and tiddler fields.

OKF key            TW field
type               okf.type (omitted when it equals the default type)
title              caption
tw.title           title (only written when the file path can't reproduce it)
tags, description  tags, description
resource, status, stale_after                 okf.<key>
generated, verified, sources, usage_window    okf.<key> as JSON
other scalars      same-named field
other nested keys  okf.extra (YAML, written back as-is)

\*/

"use strict";

var jsyaml = require("$:/plugins/rimir/okf/js-yaml.js");
var scope = require("$:/plugins/rimir/okf/scope.js");
var normalizeDate = require("$:/plugins/rimir/frontmatter/document.js").normalizeDate;

var TW_TITLE_KEY = "tw.title";
var EXTRA_FIELD = "okf.extra";
// OKF keys stored as okf.<key>: true = structured (JSON), false = scalar
var OKF_KEYS = {
	resource: false, status: false, stale_after: false,
	generated: true, verified: true, sources: true, usage_window: true
};
var LIST_KEYS = {tags: true, list: true};
var DATE_KEYS = {created: true, modified: true};
// Keys handled explicitly by fromOkf
var HANDLED_KEYS = {type: true, title: true, text: true, bag: true};
HANDLED_KEYS[TW_TITLE_KEY] = true;
// Fields handled explicitly by toOkf
var HANDLED_FIELDS = {title: true, text: true, type: true, bag: true, revision: true,
	caption: true, description: true, tags: true};
HANDLED_FIELDS["okf.type"] = true;
HANDLED_FIELDS[EXTRA_FIELD] = true;

// FAILSAFE keeps every scalar a string: TW dates (17 digits) stay exact and
// values round-trip textually (5000 stays 5000, not "5000")
var YAML_OPTIONS = {schema: jsyaml.FAILSAFE_SCHEMA};
var DUMP_OPTIONS = {schema: jsyaml.FAILSAFE_SCHEMA, lineWidth: -1, noRefs: true};

function isScalar(value) {
	return value === null || typeof value !== "object";
}

function scalarString(value) {
	return value === null || value === undefined ? "" : String(value);
}

exports.load = function(yamlText) {
	var data = jsyaml.load(yamlText, YAML_OPTIONS);
	return data && typeof data === "object" && !Array.isArray(data) ? data : null;
};

exports.dump = function(data) {
	return jsyaml.dump(data, DUMP_OPTIONS).replace(/\n$/, "");
};

/**
 * Map an OKF document to tiddler fields.
 * ctx: {body, pathTitle, defaultType, tiddlerType}
 */
exports.fromOkf = function(data, ctx) {
	var fields = {text: ctx.body, type: ctx.tiddlerType},
		okfTyped = scope.isOkfType(data.type),
		extra = {},
		hasExtra = false;
	// Title: tw.title names the tiddler; in an OKF file `title` is the display
	// name. A file without an OKF type and tw.title was written by frontmatter,
	// so its `title` is the tiddler title.
	if(data[TW_TITLE_KEY]) {
		fields.title = scalarString(data[TW_TITLE_KEY]);
		if(data.title) {
			fields.caption = scalarString(data.title);
		}
	} else if(okfTyped) {
		if(ctx.pathTitle) {
			fields.title = ctx.pathTitle;
		}
		if(data.title) {
			fields.caption = scalarString(data.title);
		}
	} else if(data.title || ctx.pathTitle) {
		fields.title = data.title ? scalarString(data.title) : ctx.pathTitle;
	}
	if(okfTyped && data.type !== ctx.defaultType) {
		fields["okf.type"] = data.type;
	}
	$tw.utils.each(data, function(value, key) {
		if(HANDLED_KEYS[key] || value === null || value === undefined) {
			return;
		}
		if(LIST_KEYS[key]) {
			fields[key] = Array.isArray(value) ? $tw.utils.stringifyList(value.map(scalarString)) : scalarString(value);
		} else if(DATE_KEYS[key] && isScalar(value)) {
			fields[key] = normalizeDate(scalarString(value));
		} else if($tw.utils.hop(OKF_KEYS, key)) {
			fields["okf." + key] = OKF_KEYS[key] || !isScalar(value) ? JSON.stringify(value) : scalarString(value);
		} else if(isScalar(value)) {
			fields[key] = scalarString(value);
		} else {
			extra[key] = value;
			hasExtra = true;
		}
	});
	if(hasExtra) {
		fields[EXTRA_FIELD] = exports.dump(extra);
	}
	return fields;
};

/**
 * Map a tiddler to an OKF document (plain object, key order = output order).
 * ctx: {pathTitle, defaultType, reserved} — reserved: index.md / log.md get no default type
 */
exports.toOkf = function(tiddler, ctx) {
	var fields = tiddler.fields,
		data = {},
		okfType = fields["okf.type"] || (ctx.reserved ? "" : ctx.defaultType);
	if(okfType) {
		data.type = okfType;
	}
	if(fields.caption) {
		data.title = fields.caption;
	}
	if(fields.title !== ctx.pathTitle) {
		data[TW_TITLE_KEY] = fields.title;
	}
	if(fields.description) {
		data.description = fields.description;
	}
	var tags = $tw.utils.parseStringArray(fields.tags || []);
	if(tags.length) {
		data.tags = tags;
	}
	Object.keys(fields).sort().forEach(function(name) {
		if(HANDLED_FIELDS[name]) {
			return;
		}
		var value = fields[name];
		var date = DATE_KEYS[name] && (value instanceof Date ? value : $tw.utils.parseDate(value));
		if(date && !isNaN(date.getTime())) {
			data[name] = date.toISOString();
		} else if(LIST_KEYS[name]) {
			data[name] = $tw.utils.parseStringArray(value);
		} else if(name.indexOf("okf.") === 0 && $tw.utils.hop(OKF_KEYS, name.substr(4))) {
			var key = name.substr(4),
				text = tiddler.getFieldString(name);
			if(OKF_KEYS[key] || /^[\[{]/.test(text)) {
				try {
					data[key] = JSON.parse(text);
					return;
				} catch(e) {
					// Not JSON (hand-edited) — keep as text
				}
			}
			data[key] = text;
		} else {
			data[name] = tiddler.getFieldString(name);
		}
	});
	if(fields[EXTRA_FIELD]) {
		var extra;
		try {
			extra = exports.load(fields[EXTRA_FIELD]);
		} catch(e) {
			extra = null;
		}
		$tw.utils.each(extra || {}, function(value, key) {
			if(!$tw.utils.hop(data, key)) {
				data[key] = value;
			}
		});
	}
	return data;
};
