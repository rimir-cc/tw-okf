/*\
title: $:/plugins/rimir/okf/scope.js
type: application/javascript
module-type: library

Decides which frontmatter documents are handled as OKF.

* A YAML `type` that is not a TW content type is always OKF (safety rule)
* Otherwise the user filter decides; an empty filter means every document

\*/

"use strict";

/**
 * True if `type` is a content type this wiki knows (registered or parseable).
 */
var isTwType = exports.isTwType = function(type) {
	return !!($tw.config.contentTypeInfo[type] || ($tw.Wiki.parsers && $tw.Wiki.parsers[type]));
};

/**
 * True if `type` is an OKF concept type (non-empty and not a TW content type).
 */
exports.isOkfType = function(type) {
	return typeof type === "string" && type !== "" && !isTwType(type);
};

/**
 * True if the tiddler (fields or $tw.Tiddler) matches `filter`.
 * Evaluated against a wiki that holds only this tiddler, so the result is the
 * same on load (tiddler not yet in the wiki) and on save.
 */
exports.matchesFilter = function(tiddler, filter) {
	filter = (filter || "").trim();
	if(!filter) {
		return true;
	}
	if(!(tiddler instanceof $tw.Tiddler)) {
		tiddler = new $tw.Tiddler(tiddler);
	}
	var title = tiddler.fields.title || "$:/temp/rimir/okf/untitled";
	if(!tiddler.fields.title) {
		tiddler = new $tw.Tiddler(tiddler, {title: title});
	}
	var wiki = new $tw.Wiki();
	wiki.addTiddler(tiddler);
	return wiki.filterTiddlers(filter).indexOf(title) !== -1;
};
