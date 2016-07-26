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
const Clutter = imports.gi.Clutter;
const Signals = imports.signals;
const ExtensionUtils = imports.misc.extensionUtils;

const Me = ExtensionUtils.getCurrentExtension();
const Utils = Me.imports.utils;
const PrefsKeys = Me.imports.prefs_keys;
const EntrySuggestions = Me.imports.entry_suggestions;
const HistoryManager = Me.imports.history_manager;
const Extension = Me.imports.extension;

const SearchEntry = new Lang.Class({
    Name: 'HowDoISeachEntry',

    _init: function() {
        this.actor = new St.Entry({
            style_class: 'howdoi-search-entry',
            hint_text: 'Type or <Ctrl>V to search...',
            track_hover: true,
            can_focus: true
        });
        this.actor.set_x_align(Clutter.ActorAlign.FILL);
        this.actor.set_y_align(Clutter.ActorAlign.START);
        this.actor.set_x_expand(false);
        this.actor.set_y_expand(false);
        this.actor.clutter_text.connect(
            'text-changed',
            Lang.bind(this, this._on_text_changed)
        );
        this.actor.connect(
            'secondary-icon-clicked',
            Lang.bind(this, this.clear)
        );
        this.actor.clutter_text.connect(
            'activate',
            Lang.bind(this, this._activate)
        );
        this.actor.clutter_text.connect(
            'key-press-event',
            Lang.bind(this, this._on_key_press)
        );

        let primary_icon = new St.Icon({
            style_class: 'howdoi-search-entry-icon',
            icon_name: 'edit-find-symbolic'
        });
        this.actor.set_primary_icon(primary_icon);

        this._secondary_icon = new St.Icon({
            style_class: 'howdoi-search-entry-icon',
            icon_name: 'edit-clear-symbolic',
            visible: false
        });
        this.actor.set_secondary_icon(this._secondary_icon);

        this._history = new HistoryManager.HistoryManager({
            key: PrefsKeys.HISTORY,
            limit: Utils.SETTINGS.get_int(PrefsKeys.HISTORY_LIMIT),
            settings: Utils.SETTINGS
        });

        this._entry_suggestions =
            new EntrySuggestions.EntrySuggestions(this);
        this._entry_suggestions.connect(
            'activate',
            Lang.bind(this, this._activate)
        );
    },

    _on_text_changed: function() {
        if(this.is_empty()) {
            this._secondary_icon.hide();
            this._history.reset();
        }
        else {
            this._secondary_icon.show();
        }

        return Clutter.EVENT_STOP;
    },

    _on_key_press: function(sender, event) {
        let symbol = event.get_key_symbol();
        let control = event.has_control_modifier();
        let shift = event.has_shift_modifier();
        let alt = (event.get_state() & Clutter.ModifierType.MOD1_MASK)
        let code = event.get_key_code();

        if(symbol === Clutter.Right && !shift && !control) {
            let selection = this.clutter_text.get_selection();

            if(
                !Utils.is_blank(selection) &&
                this.clutter_text.get_selection_bound() === -1
            ) {
                this.clutter_text.set_cursor_position(
                    this.text.length
                );

                return Clutter.EVENT_STOP;
            }
        }
        else if(symbol === Clutter.Up && !control && !shift) {
            if(this._entry_suggestions.shown) return Clutter.EVENT_PROPAGATE;
            return this.history_prev();
        }
        else if(symbol === Clutter.Down && !control && !shift) {
            if(this._entry_suggestions.shown) return Clutter.EVENT_PROPAGATE;
            return this.history_next();
        }
        else if(code === 54 && control && alt) {
            Extension.howdoi._on_key_press_event(this.actor, event);
            return Clutter.EVENT_STOP;
        }

        return Clutter.EVENT_PROPAGATE;
    },

    _activate: function() {
        this._history.add(this.text);
        this._history.reset();
        this.emit('activate');
    },

    is_empty: function() {
        if(
            Utils.is_blank(this.actor.text) ||
            this.actor.text === this.actor.hint_text
        ) {
            return true
        }
        else {
            return false;
        }
    },

    clear: function() {
        if(!this.is_empty()) this.actor.set_text('');
    },

    set_text: function(text) {
        this.actor.set_text(text);
    },

    grab_key_focus: function(select_text) {
        if(!this.is_empty() && select_text === true) {
            this.actor.clutter_text.set_selection(0, this.text.length);
        }

        this.actor.grab_key_focus();
    },

    history_prev: function() {
        let prev = this._history.prev();

        if(prev) {
            this._entry_suggestions.ignore_change = true;
            this.set_text(prev);
            this.clutter_text.set_selection_bound(-1);
            return Clutter.EVENT_STOP;
        }
        else {
            return Clutter.EVENT_PROPAGATE;
        }
    },

    history_next: function() {
        let next = this._history.next();
        this._entry_suggestions.ignore_change = true;

        if(next) {
            this.set_text(next);
            this.clutter_text.set_selection_bound(-1);
            return Clutter.EVENT_STOP;
        }
        else {
            this.set_text('');
            return Clutter.EVENT_PROPAGATE;
        }
    },

    destroy: function() {
        this._history.destroy();
        this._entry_suggestions.destroy();
        this._secondary_icon.destroy();
        this.actor.destroy();
    },

    get text() {
        return !this.is_empty() ? this.actor.get_text() : '';
    },

    get query() {
        if(Utils.is_blank(this.text)) return '';

        let query = this.text;
        let keyword = Extension.howdoi.get_keyword_for_query(query);
        if(keyword) query = query.slice(keyword.length);
        return query;
    },

    get keyword() {
        return Extension.howdoi.get_keyword_for_query(this.text);
    },

    get clutter_text() {
        return this.actor.clutter_text;
    },

    get suggestions() {
        return this._entry_suggestions;
    },

    get history() {
        return this._history;
    }
});
Signals.addSignalMethods(SearchEntry.prototype);
