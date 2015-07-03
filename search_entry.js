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
const EntrySuggestions = Me.imports.entry_suggestions;

const SearchEntry = new Lang.Class({
    Name: 'HowDoISeachEntry',

    _init: function() {
        this.actor = new St.Entry({
            style_class: 'howdoi-search-entry',
            hint_text: 'Type to search...',
            track_hover: true,
            can_focus: true
        });
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

        this._entry_suggestions =
            new EntrySuggestions.EntrySuggestions(this.actor);
        this._entry_suggestions.connect(
            'activate',
            Lang.bind(this, this._activate)
        );
    },

    _on_text_changed: function() {
        if(this.is_empty()) this._secondary_icon.hide();
        else this._secondary_icon.show();

        return Clutter.EVENT_STOP;
    },

    _on_key_press: function(sender, event) {
        let symbol = event.get_key_symbol();
        let control = event.has_control_modifier();
        let shift = event.has_shift_modifier();

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

        return Clutter.EVENT_PROPAGATE;
    },

    _activate: function() {
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

    destroy: function() {
        this._entry_suggestions.destroy();
        this._secondary_icon.destroy();
        this.actor.destroy();
    },

    get text() {
        return !this.is_empty() ? this.actor.get_text() : '';
    },

    get clutter_text() {
        return this.actor.clutter_text;
    },

    get suggestions() {
        return this._entry_suggestions;
    }
});
Signals.addSignalMethods(SearchEntry.prototype);
