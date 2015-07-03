/*
    Copyright 2015 Ivan awamper@gmail.com

    This program is free software; you can redistribute it and/or
    modify it under the terms of the GNU General Public License as
    published by the Free Software Foundation; either version 2 of
    the License, or (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program. If not, see <http://www.gnu.org/licenses/>.
*/

const St = imports.gi.St;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const Signals = imports.signals;
const Tweener = imports.ui.tweener;
const Main = imports.ui.main;
const ExtensionUtils = imports.misc.extensionUtils;

const Me = ExtensionUtils.getCurrentExtension();
const Utils = Me.imports.utils;
const PrefsKeys = Me.imports.prefs_keys;
const PopupDialog = Me.imports.popup_dialog;
const GoogleSuggestions = Me.imports.google_suggestions;

const TIMEOUT_IDS = {
    SUGGESTIONS: 0
};

const CONNECTION_IDS = {
    ENABLE_CALCULATOR: 0,
    ENABLE_SUGGESTIONS: 0
};

const HIGHLIGHT_MARKUP = {
    START: '<span foreground="white" font_weight="heavy" underline="single">',
    STOP: '</span>'
};

const GoogleEntrySuggestionItem = new Lang.Class({
    Name: 'GoogleEntrySuggestionItem',

    _init: function(suggestion, reactive) {
        this.suggestion = suggestion;

        this.actor = new St.BoxLayout({
            style_class: 'howdoi-entry-suggestion-item-box howdoi-entry-suggestion-item-button',
            reactive: reactive,
            track_hover: reactive,
            vertical: false
        });
        this.actor.connect('key-release-event',
            Lang.bind(this, this._on_key_release)
        );
        this.actor.connect('button-release-event',
            Lang.bind(this, this._on_button_release)
        );
        this.set_reactive(reactive);

        this._label = new St.Label({
            text: this.suggestion.text
        });
        this.actor.add(this._label, {
            expand: false,
            x_align: St.Align.START
        });

        this._calc_result = new St.Label();
        this.actor.add(this._calc_result, {
            expand: true,
            x_align: St.Align.START
        })
    },

    _on_key_release: function(sender, event) {
        let symbol = event.get_key_symbol();

        if(symbol === Clutter.Return || symbol === Clutter.KEY_space) {
            this.emit('activate');
        }

        return Clutter.EVENT_STOP;
    },

    _on_button_release: function(sender, event) {
        this.activate();
        return Clutter.EVENT_STOP;
    },

    set_markup: function(markup) {
        if(Utils.is_blank(markup)) {
            this._label.set_text(this.suggestion.text);
        }
        else {
            this._label.clutter_text.set_markup(markup);
        }
    },

    set_calc_result: function(text) {
        let markup = '%s<span size="x-small"><i>%s</i></span>'.format(
            /\s+$/.test(this.suggestion.text) ? '' : ' ',
            text
        );
        this._calc_result.clutter_text.set_markup(markup);
    },

    set_reactive: function(reactive) {
        this.actor.reactive = reactive;
        this.actor.track_hover = reactive;
        if(!reactive) this.actor.add_style_pseudo_class('inactive');
        else this.actor.remove_style_pseudo_class('inactive');
    },

    activate: function() {
        this.emit('activate');
    },

    destroy: function() {
        this.actor.destroy();
    },

    get has_calc_result() {
        return !Utils.is_blank(this._calc_result.text);
    }
});
Signals.addSignalMethods(GoogleEntrySuggestionItem.prototype);

const DummySuggestionItem = new Lang.Class({
    Name: 'GoogleEntrySuggestionDummyItem',
    Extends: GoogleEntrySuggestionItem,

    _init: function() {
        this.parent({
            text: 'Dummy suggestion item',
            relevance: 390,
            type: 'QUERY'
        }, true);
    }
});

const GoogleEntrySuggestions = new Lang.Class({
    Name: 'GoogleEntrySuggestions',
    Extends: PopupDialog.PopupDialog,

    _init: function(entry) {
        this.parent({
            modal: false
        });

        this._box = new St.BoxLayout({
            style_class: 'howdoi-suggestions-dialog',
            vertical: true
        });
        this.actor.add_child(this._box);

        this._entry = entry;
        this._entry.clutter_text.connect(
            'key-press-event',
            Lang.bind(this, this._on_entry_key_press)
        );
        this._entry.clutter_text.connect(
            'text-changed',
            Lang.bind(this, this._on_text_changed)
        );

        this._cache = new GoogleSuggestionsCache();
        this._suggestions = new GoogleSuggestions.GoogleSuggestions();
        this._suggestion_items = [];
        this._showing = false;
        this._ignore_text_change = false;
        this._abort_trigger = false;

        CONNECTION_IDS.ENABLE_CALCULATOR = Utils.SETTINGS.connect(
            'changed::' + PrefsKeys.ENABLE_CALCULATOR,
            Lang.bind(this, function() {
                this._cache.clear();
            })
        );
        CONNECTION_IDS.ENABLE_SUGGESTIONS = Utils.SETTINGS.connect(
            'changed::' + PrefsKeys.ENABLE_SUGGESTIONS,
            Lang.bind(this, function() {
                this._cache.clear();
            })
        );
    },

    _on_entry_key_press: function(sender, event) {
        if(
            !Utils.SETTINGS.get_boolean(PrefsKeys.ENABLE_SUGGESTIONS) &&
            !Utils.SETTINGS.get_boolean(PrefsKeys.ENABLE_CALCULATOR)
        ) {
            return Clutter.EVENT_PROPAGATE;
        }

        let symbol = event.get_key_symbol();
        let is_enter = (
            symbol === Clutter.KEY_Return ||
            symbol === Clutter.KEY_KP_Enter ||
            symbol === Clutter.KEY_ISO_Enter
        );

        if(symbol === Clutter.Up) {
            this.select_prev();
        }
        else if(symbol === Clutter.Down) {
            if(this.shown) this.select_next();
            else this.show();
        }
        else if(Utils.symbol_is_tab(symbol)) {
            this.select_next();
        }
        else if(is_enter) {
            if(this.shown || this._showing) {
                let selected = this.get_selected();
                if(selected) selected.activate();
                return Clutter.EVENT_STOP;
            }
            else {
                this._abort_trigger = true;
                return Clutter.EVENT_PROPAGATE;
            }

        }

        return Clutter.EVENT_PROPAGATE;
    },

    _on_suggestion_activate: function(suggestion_item) {
        this._ignore_text_change = true;
        this._entry.set_text(suggestion_item.suggestion.text);
        this.hide();
        this.emit('activate');
    },

    _calculate_height: function() {
        let dummy = new DummySuggestionItem();
        dummy.actor.opacity = 0;
        Main.uiGroup.add_child(dummy.actor);
        let height = (
            dummy.actor.height *
            (Utils.SETTINGS.get_int(PrefsKeys.MAX_GOOGLE_SUGGESTIONS) + 1)
        );
        Main.uiGroup.remove_child(dummy.actor);

        return height;
    },

    _reposition: function() {
        let margin_top = 3;
        let [x, y] = this._entry.get_transformed_position();
        let allocation_box = this._entry.get_allocation_box();

        this._box.height = this._calculate_height();
        this._box.width = this._entry.width;

        this.actor.x = x;
        this.actor.y = this._entry.height + y + margin_top;
    },

    _highlight_suggestions: function(query) {
        for each(let suggestion_item in this._suggestion_items) {
            let text = suggestion_item.suggestion.text;
            let regexp = new RegExp("(" + query.trim() + ")", "i");
            text = text.replace(regexp, '%s$1%s'.format(
                HIGHLIGHT_MARKUP.START,
                HIGHLIGHT_MARKUP.STOP
            ));
            suggestion_item.set_markup(text);
        }
    },

    _show_suggestions: function(suggestions) {
        let first_suggestion = {
            text: this._entry.text,
            relevance: 9999999,
            type: GoogleSuggestions.SUGGESTION_TYPE.QUERY,
            calc_result: ''
        };

        if(Utils.SETTINGS.get_boolean(PrefsKeys.ENABLE_CALCULATOR)) {
            if(suggestions.length > 0 && suggestions[0].text !== first_suggestion.text) {
                for each(let suggestion in suggestions) {
                    if(suggestion.type === GoogleSuggestions.SUGGESTION_TYPE.CALCULATOR) {
                        first_suggestion.calc_result = suggestion.text;
                        suggestions.splice(suggestions.indexOf(suggestion), 1);
                        break;
                    }
                }
            }
        }

        suggestions.unshift(first_suggestion);

        for(let i = 0; i < suggestions.length; i++) {
            if(this._suggestion_items[i] !== undefined) {
                let new_suggestion = suggestions[i];
                let old_suggestion_item = this._suggestion_items[i];
                if(
                    new_suggestion.text.trim() ===
                    old_suggestion_item.suggestion.text.trim()
                ) continue;

                let reactive = (
                    new_suggestion.type !==
                    GoogleSuggestions.SUGGESTION_TYPE.CALCULATOR
                );
                let new_suggestion_item =
                    new GoogleEntrySuggestionItem(new_suggestion, reactive);
                new_suggestion_item.connect('activate',
                    Lang.bind(this, this._on_suggestion_activate)
                );

                if(!Utils.is_blank(new_suggestion.calc_result)) {
                    new_suggestion_item.set_calc_result(new_suggestion.calc_result);
                }

                if(i > 0 && Utils.SETTINGS.get_boolean(PrefsKeys.ENABLE_ANIMATIONS)) {
                    Tweener.removeTweens(old_suggestion_item.actor);
                    Tweener.addTween(old_suggestion_item.actor, {
                        time: 0.15,
                        opacity: 100,
                        transition: 'easeOutExpo',
                        onComplete: Lang.bind(this, function() {
                            this._box.replace_child(
                                old_suggestion_item.actor,
                                new_suggestion_item.actor
                            );
                            old_suggestion_item.destroy();
                        })
                    });
                }
                else {
                    this._box.replace_child(
                        old_suggestion_item.actor,
                        new_suggestion_item.actor
                    );
                    old_suggestion_item.destroy();
                }

                this._suggestion_items[i] = new_suggestion_item;
            }
            else {
                let reactive = (
                    suggestions[i].type !==
                    GoogleSuggestions.SUGGESTION_TYPE.CALCULATOR
                );
                let suggestion_item =
                    new GoogleEntrySuggestionItem(suggestions[i], reactive);
                suggestion_item.connect('activate',
                    Lang.bind(this, this._on_suggestion_activate)
                );

                if(!Utils.is_blank(suggestions[i].calc_result)) {
                    suggestion_item.set_calc_result(suggestions[i].calc_result);
                }

                this._suggestion_items.push(suggestion_item);
                this._box.add(suggestion_item.actor, {
                    expand: false,
                    x_fill: true
                });
            }
        }

        if(suggestions.length < this._suggestion_items.length) {
            let new_suggestion_items = [];

            for(let i = 0; i < this._suggestion_items.length; i++) {
                let suggestion_item = this._suggestion_items[i];

                if(
                    suggestions[i] !== undefined &&
                    suggestions[i].text === suggestion_item.suggestion.text
                ) {
                    new_suggestion_items.push(suggestion_item);
                    continue
                }

                Tweener.removeTweens(suggestion_item.actor);
                Tweener.addTween(suggestion_item.actor, {
                    time: 0.5,
                    opacity: 0,
                    transition: 'easeOutExpo',
                    onComplete: Lang.bind(this, function() {
                        suggestion_item.destroy();
                    })
                });
            }

            this._suggestion_items = new_suggestion_items;
        }

        this.select_suggestion(this._suggestion_items[0]);
    },

    _on_text_changed: function(clutter_text) {
        this._remove_timeouts();

        if(
            !Utils.SETTINGS.get_boolean(PrefsKeys.ENABLE_CALCULATOR) &&
            !Utils.SETTINGS.get_boolean(PrefsKeys.ENABLE_SUGGESTIONS)
        ) return;

        if(this._ignore_text_change) {
            this._ignore_text_change = false;
            return;
        }

        if(Utils.is_empty_entry(this._entry)) {
            this.clear();
            this.hide();
            return;
        }

        let cached = this._cache.get(this._entry.text.trim());

        if(cached) {
            this.show();
            this._show_suggestions(cached);
            this._highlight_suggestions(this._entry.text);
            return;
        }

        TIMEOUT_IDS.SUGGESTIONS = Mainloop.timeout_add(
            Utils.SETTINGS.get_int(PrefsKeys.SUGGESTIONS_TIMEOUT),
            Lang.bind(this, function() {
                TIMEOUT_IDS.SUGGESTIONS = 0;
                let types = [];

                if(Utils.SETTINGS.get_boolean(PrefsKeys.ENABLE_SUGGESTIONS)) {
                    types.push(GoogleSuggestions.SUGGESTION_TYPE.QUERY);
                }
                if(Utils.SETTINGS.get_boolean(PrefsKeys.ENABLE_CALCULATOR)) {
                    types.push(GoogleSuggestions.SUGGESTION_TYPE.CALCULATOR);
                }

                this._suggestions.get_suggestions(
                    this._entry.text,
                    types,
                    Utils.SETTINGS.get_int(PrefsKeys.MAX_GOOGLE_SUGGESTIONS),
                    Lang.bind(this, this._on_suggestions)
                );

                return GLib.SOURCE_REMOVE;
            })
        );
    },

    _on_suggestions: function(query, result, error_message) {
        if(this._entry.text !== query) return;
        if(result === null) {
            log('GoogleEntrySuggestions:_on_text_changed(): %s'.format(
                error_message)
            );
            this.hide();
            return;
        }

        this.show();
        this._cache.add(query, result);
        this._show_suggestions(result);
        this._highlight_suggestions(query);
    },

    _remove_timeouts: function() {
        if(TIMEOUT_IDS.SUGGESTIONS > 0) {
            Mainloop.source_remove(TIMEOUT_IDS.SUGGESTIONS);
            TIMEOUT_IDS.SUGGESTIONS = 0;
        }
    },

    get_selected: function() {
        let result = false;

        for each(let suggestion_item in this._suggestion_items) {
            if(suggestion_item.actor.has_style_pseudo_class('selected')) {
                result = suggestion_item;
            }
        }

        return result;
    },

    unselect_all: function() {
        for each(let suggestion_item in this._suggestion_items) {
            suggestion_item.actor.remove_style_pseudo_class('hover');
            suggestion_item.actor.remove_style_pseudo_class('selected');
        }
    },

    unselect_suggestion: function(suggestion_item) {
        suggestion_item.actor.remove_style_pseudo_class('selected');
    },

    select_suggestion: function(suggestion_item) {
        this._remove_timeouts();
        this.unselect_all();
        suggestion_item.actor.add_style_pseudo_class('selected');

        let real_length = this._suggestion_items[0].suggestion.text.length;
        this._ignore_text_change = true;
        this._entry.set_text(suggestion_item.suggestion.text);
        this._entry.clutter_text.set_selection(real_length, -1);

        let index = this._suggestion_items.indexOf(suggestion_item);
        if(suggestion_item.has_calc_result || index === 0) return;
        if(!Utils.SETTINGS.get_boolean(PrefsKeys.ENABLE_CALCULATOR)) return;

        TIMEOUT_IDS.SUGGESTIONS = Mainloop.timeout_add(300,
            Lang.bind(this, function() {
                TIMEOUT_IDS.SUGGESTIONS = 0;
                this._suggestions.get_suggestions(
                    suggestion_item.suggestion.text,
                    [GoogleSuggestions.SUGGESTION_TYPE.CALCULATOR],
                    1,
                    Lang.bind(this, function(query, result, error_message) {
                        if(result === null || result.length < 1) return;
                        suggestion_item.set_calc_result(result[0].text);
                    })
                );

                return GLib.SOURCE_REMOVE;
            })
        );
    },

    select_next: function() {
        if(this._suggestion_items.length < 1) return false;

        let selected = this.get_selected();
        if(!selected) {
            this.select_suggestion(this._suggestion_items[0]);
            return true;
        }

        let selected_index = this._suggestion_items.indexOf(selected);
        let next_item = null;
        let next_index = selected_index + 1;

        for(let i = next_index; i < this._suggestion_items.length; i++) {
            let item = this._suggestion_items[i];
            if(item.actor.has_style_pseudo_class('inactive')) continue;

            next_item = item;
            break;
        }

        if(next_item !== null) {
            this.select_suggestion(next_item);
            return true;
        }
        else {
            return false
        }
    },

    select_prev: function() {
        if(this._suggestion_items.length < 1) return false;

        let selected = this.get_selected();
        if(!selected) {
            this.select_suggestion(this._suggestion_items[0]);
            return true;
        }

        let selected_index = this._suggestion_items.indexOf(selected);
        let prev_item = null;
        let prev_index = selected_index - 1;

        for(let i = prev_index; i >= 0; i--) {
            let item = this._suggestion_items[i];
            if(item.actor.has_style_pseudo_class('inactive')) continue;

            prev_item = item;
            break;
        }

        if(prev_item !== null) {
            this.select_suggestion(prev_item);
            return true;
        }
        else {
            return false
        }
    },

    clear: function() {
        this._box.destroy_all_children();
        this._suggestion_items = [];
    },

    show: function(animation) {
        if(this.shown || this._showing) return;

        if(this._abort_trigger) {
            this._abort_trigger = false;
            return;
        }

        this._showing = true;
        this._reposition();

        Main.uiGroup.set_child_above_sibling(this.actor, null);
        this.actor.set_opacity(0);
        this.actor.show();

        animation =
            animation === undefined
            ? Utils.SETTINGS.get_boolean(PrefsKeys.ENABLE_ANIMATIONS)
            : animation;

        if(!animation) {
            this.actor.set_opacity(255);
            this.actor.set_scale(1, 1);
            this._show_done();
            this.shown = true;
            this._showing = false;
            return;
        }

        Tweener.removeTweens(this.actor);
        Tweener.addTween(this.actor, {
            opacity: 255,
            time: 0.2,
            transition: 'easeOutExpo',
            onComplete: Lang.bind(this, function() {
                this._show_done();
                this.shown = true;
                this._showing = false;
            })
        });
    },

    hide: function(animation) {
        // if(!this.shown) return;

        animation =
            animation === undefined
            ? Utils.SETTINGS.get_boolean(PrefsKeys.ENABLE_ANIMATIONS)
            : animation;

        if(!animation) {
            this.actor.hide();
            this.actor.set_opacity(255);
            this._hide_done();
            this.shown = false;
            return;
        }

        Tweener.removeTweens(this.actor);
        Tweener.addTween(this.actor, {
            opacity: 0,
            time: 0.2,
            transition: 'easeOutExpo',
            onComplete: Lang.bind(this, function() {
                this.actor.hide();
                this.actor.set_opacity(255);
                this._hide_done();
                this.shown = false;
            })
        });
    },

    destroy: function() {
        this._remove_timeouts();
        this._suggestions.destroy();
        this.clear();
        this._entry = null;

        Utils.SETTINGS.disconnect(CONNECTION_IDS.ENABLE_CALCULATOR);
        Utils.SETTINGS.disconnect(CONNECTION_IDS.ENABLE_SUGGESTIONS);
        CONNECTION_IDS.ENABLE_CALCULATOR = 0;
        CONNECTION_IDS.ENABLE_SUGGESTIONS = 0;

        this.parent();
    }
});
Signals.addSignalMethods(GoogleEntrySuggestions.prototype);

const GoogleSuggestionsCache = new Lang.Class({
    Name: 'GoogleSuggestionsCache',

    _init: function() {
        this._items = [];
    },

    add: function(query, suggestions) {
        let limit = Utils.SETTINGS.get_int(PrefsKeys.SUGGESTIONS_CACHE_LIMIT);
        if(this.get(query)) return;
        if(this._items.length >= limit) this._items.shift();
        this._items.push({
            hash: Utils.fnv32a(query),
            suggestions: JSON.stringify(suggestions)
        });
    },

    get: function(query) {
        let result = false;

        for each(let item in this._items) {
            if(item.hash === Utils.fnv32a(query)) {
                result = JSON.parse(item.suggestions);
                break;
            }
        }

        return result;
    },

    clear: function() {
        this._items = [];
    },

    destroy: function() {
        this.clear();
    }
});
