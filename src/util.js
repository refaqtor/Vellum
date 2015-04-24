define([
    'json!langCodes',
    'underscore',
    'jsdiff',
    'jquery',
    'jquery.bootstrap-popout'
], function (
    langCodes,
    _,
    jsdiff,
    $
) {
    RegExp.escape = function(s) {
        return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    };
    
    $.fn.stopLink = function() {
        // stops anchor tags from clicking through
        this.click(function (e) {
            e.preventDefault();
        });
        return this;
    };

    $.fn.fdHelp = function () {
        // creates a help popover, requires twitter bootstrap
        this.append($('<i />').addClass('icon-question-sign'))
            .popout({
                trigger: 'hover',
                html: true
            });
        return this;
    };

    var that = {};

    // deep extend
    that.extend = function () {
        var args = Array.prototype.slice.call(arguments);

        return $.extend.apply(null, [true, {}].concat(args));
    };

    that.langCodeToName = {};
    _.each(langCodes, function (lang) {
        var name = lang.names[0];
        that.langCodeToName[lang.three] = name;
        that.langCodeToName[lang.two] = name;
    });

    that.formatExc = function (error) {
        return error && error.stack ? error.stack : String(error);
    };

    that.XPATH_REFERENCES = [
        "relevantAttr",
        "calculateAttr",
        "constraintAttr",
        "dataParent",
        "repeat_count"
    ];

    that.getTemplateObject = function (selector, params) {
        return $(_.template($(selector).text(), params));
    };
    
    that.validAttributeRegex = /^[^<&'"]$/;
    that.invalidAttributeRegex = /[<&'"]/;

    /**
     * Check if value is a valid XML attribute value (additionally disallow all
     * ' and ")
     */
    that.isValidAttributeValue = function (value) {
        return that.validAttributeRegex.test(value);
    };
    
    // Simple Event Framework
    // Just run your object through this function to make it event aware.
    // Adapted from 'JavaScript: The Good Parts' chapter 5
    that.eventuality = function (that) {
        var registry = {},
            unbinders = {};
        /**
         * Fire event, calling all registered handlers
         */
        that.fire = function (event) {
            var array,
                func,
                handler,
                i,
                type = typeof event === 'string' ? event : event.type;
            if (registry.hasOwnProperty(type)) {
                array = registry[type];
                for (i = 0; i < array.length; i += 1) {
                    handler = array[i];
                    func = handler.method;
                    if (typeof func === 'string') {
                        func = this[func];
                    }
                    func.apply(this, handler.parameters || [event]);
                }
            }
            return this;
        };
        /**
         * Register an event handler to be called each time an event is fired.
         *
         * @param type - Event type string.
         * @param method - Event handler method.
         * @param parameters - Parameters to be passed to method. If null
         *      or not provided, the event object itself will be passed.
         * @param unbindOn - (optional) Event type on which to unbind
         *      all handlers associated with `context`. To make a one-
         *      shot, use the same value for this parameter as for
         *      `type`.
         * @param context - (optional) Context for `unbind`. The
         *      default is `null`. The handler (and all other handlers
         *      bound to the same context) will be unbound the next time
         *      the `unbindOn` event fires or `this.unbind(context)` is
         *      called, whichever happens first.
         */
        that.on = function (type, method, parameters, unbindOn, context) {
            if (arguments.length < 5) {
                context = null;
            }
            var handler = {
                method: method,
                parameters: parameters,
                context: context
            };
            if (registry.hasOwnProperty(type)) {
                registry[type].push(handler);
            } else {
                registry[type] = [handler];
            }
            if (unbindOn) {
                if (!unbinders[unbindOn]) {
                    unbinders[unbindOn] = [];
                }
                if (unbinders[unbindOn].indexOf(context) === -1) {
                    unbinders[unbindOn].push(context);
                    that.on(unbindOn, function () {
                        that.unbind(context);
                        unbinders[unbindOn] = _.filter(unbinders[unbindOn], function (cx) {
                            return cx !== context;
                        });
                    }, null, null, context);
                }
            }
            return this;
        };
        /**
         * Unbind an event handler for a given binding context
         *
         * @param context - the binding context that was passed to `on`.
         * @param type - optional event type. If undefined, all handlers
         *        for the given binding context will be unbound.
         */
        that.unbind = function (context, type) {
            if (_.isUndefined(type)) {
                registry = _.object(_.map(registry, function (handlers, type, reg) {
                    handlers = _.filter(handlers, function (handler) {
                        return handler.context !== context;
                    });
                    return [type, handlers];
                }));
            } else if (registry.hasOwnProperty(type)) {
                registry[type] = _.filter(registry[type], function (handler) {
                    return handler.context !== context;
                });
            }
            return this;
        };
        return that;
    };

    that.pluralize = function (noun, n) {
        return noun + (n !== 1 ? 's' : '');
    };

    /* jshint bitwise: false */
    that.get_guid = function() {
        // http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript
        var S4 = function() {
            return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
        };
        return (S4()+S4()+S4()+S4()+S4()+S4()+S4()+S4());
    };

    that.generate_xmlns_uuid = function () {
        var CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
        var uuid = [], r, i;

		// rfc4122 requires these characters
		uuid[8] = uuid[13] = uuid[18] = uuid[23] = '-';
		uuid[14] = '4';

		// Fill in random data.  At i==19 set the high bits of clock sequence as
		// per rfc4122, sec. 4.1.5
		for (i = 0; i < 36; i++) {
			if (!uuid[i]) {
				r = Math.floor((Math.random()*16));
				uuid[i] = CHARS[(i === 19) ? (r & 0x3) | 0x8 : r & 0xf];
			}
		}
		return uuid.toString().replace(/,/g,'');
    };
    /* jshint bitwise: true */

    that.isValidElementName = function (name) {
        // HT: http://stackoverflow.com/questions/2519845/how-to-check-if-string-is-a-valid-xml-element-name
        var elementNameRegex = /^(?!XML)[a-zA-Z][\w-]*$/;
        return elementNameRegex.test(name);
    };
    

    /**
     * Converts true to 'true()' and false to 'false()'. Returns null for all else.
     * @param req
     */
    that.createXPathBoolFromJS = function(req) {
        if(req === true || req === 'true') {
            return 'true()';
        }else if (req === false || req === 'false') {
            return 'false()';
        } else {
            return null;
        }
    };
    
    that.getOneOrFail = function (list, infoMsg) {
        if (list.length === 0) {
            throw ("No match for " + infoMsg + " found!");
        } else if (list.length > 1) {
            throw ("Multiple matches for " + infoMsg + " found!");
        }
        return list[0];
    };
    
    that.reduceToOne = function (list, func, infoMsg) {
        return that.getOneOrFail(_(list).filter(func), infoMsg);
    };
    
    // a wrapper for object properties that triggers the form change event when
    // sub-properties are changed
    that.BoundPropertyMap = function (form, data) {
        this._form = form;
        this._data = data || {};
    };
    that.BoundPropertyMap.prototype = {
        clone: function () {
            return new that.BoundPropertyMap(this._form, this._data);
        },
        setAttr: function (name, val) {
            this._data[name] = val;
            if (this._form) {
                this._form.fire({
                    type: 'change'
                });
            }
        },
        getAttr: function (name, default_) {
            if (name in this._data) {
                return this._data[name];
            } else {
                return default_;
            }
        }
    };

    that.getCaretPosition = function (ctrl) {
        var pos = 0;
        if (ctrl.createTextRange) {
            ctrl.focus ();
            var sel = document.selection.createRange ();
            sel.moveStart ('character', -ctrl.value.length);
            pos = sel.text.length;
        } else if (typeof ctrl.selectionStart !== 'undefined') {
            pos = ctrl.selectionStart;
        }
        return pos;
    };

    that.setCaretPosition = function (ctrl, start, end){
        if (end === null || end === undefined) {
            end = start;
        }
        if (ctrl.setSelectionRange) {
            ctrl.focus();
            ctrl.setSelectionRange(start, end);
        } else if (ctrl.createTextRange) {
            var range = ctrl.createTextRange();
            range.collapse(true);
            range.moveStart('character', start);
            range.moveEnd('character', end);
            range.select();
        }
    };

    that.insertTextAtCursor = function (jqctrl, text, select) {
        var ctrl = jqctrl[0],
            pos = that.getCaretPosition(ctrl),
            front = ctrl.value.substring(0, pos),
            back = ctrl.value.substring(pos, ctrl.value.length),
            start = select ? pos : pos + text.length;
        jqctrl.val(front + text + back).change();
        pos = pos + text.length;
        that.setCaretPosition(ctrl, start, pos);
    };


    that.xmlDiff = function (localForm, serverForm, opts) {
        function cleanForDiff (value) {
            // convert leading tabs to spaces
            value = value.replace(/^\t+/mg, function (match) {
                return match.replace(/\t/g, "  ");
            });
            // add newline at end of file if missing
            if (!value.match(/\n$/)) {
                value = value + "\n";
            }
            return value;
        }
        opts = opts || {};
        if (opts.normalize_xmlns) {
            var xmlns = $($.parseXML(serverForm)).find('data').attr('xmlns');
            localForm = localForm.replace(/(data[^>]+xmlns=")(.+?)"/,
                                    '$1' + xmlns + '"');
        }
        localForm = cleanForDiff(localForm);
        serverForm = cleanForDiff(serverForm);
        var patch = jsdiff.createPatch("", serverForm, localForm, "Server Form", "Local Form");
        patch = patch.replace(/^Index:/,
                "XML " + (opts.not ? "should not be equivalent" : "mismatch"));
        return patch;
    };

    that.markdownlite = function (text) {
        // escape html characters and convert
        // - groups of "- ..." to <ul><li>...</li><li>...</li>...</ul>
        // - normal lines to <p>line</p>
        function terminateList() {
            if (list) {
                div.append(list);
                list = null;
            }
        }
        var div = $("<div />"),
            list = null,
            trimmed;
        _.each(text.split("\n"), function (line) {
            trimmed = line.trim();
            if (trimmed) {
                if (trimmed.startsWith("- ")) {
                    // list item
                    if (!list) {
                        list = $("<ul>");
                    }
                    list.append($("<li>").text(trimmed.slice(2)));
                } else {
                    terminateList();
                    div.append($("<p>").text(line));
                }
            } else {
                terminateList();
                // ignore blank line
            }
        });
        terminateList();
        return div.html();
    };

    return that;
});


