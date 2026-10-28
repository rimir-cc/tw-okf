/*\
title: $:/plugins/rimir/okf/startup.js
type: application/javascript
module-type: startup

Registers the OKF mapping on the rimir/frontmatter hooks. Runs before
frontmatter's startup so its boot re-parse of .md files already uses it.

\*/

"use strict";

exports.name = "okf";
exports.after = ["load-modules"];
exports.before = ["frontmatter"];
exports.synchronous = true;

exports.startup = function() {
	var hooks = require("$:/plugins/rimir/okf/hooks.js");
	$tw.hooks.addHook("th-frontmatter-parse", hooks.onParse);
	$tw.hooks.addHook("th-frontmatter-serialize", hooks.onSerialize);
	$tw.hooks.addHook("th-frontmatter-fileinfo", hooks.onFileInfo);
};
