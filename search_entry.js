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
const ExtensionUtils = imports.misc.extensionUtils;

const Me = ExtensionUtils.getCurrentExtension();
const Utils = Me.imports.utils;
const GoogleEntrySuggestions = Me.imports.google_entry_suggestions;

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

        this._google_entry_suggestions =
            new GoogleEntrySuggestions.GoogleEntrySuggestions(this.actor);
    },

    _on_text_changed: function() {
        if(this.is_empty()) this._secondary_icon.hide();
        else this._secondary_icon.show();

        return Clutter.EVENT_STOP;
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

    grab_key_focus: function() {
        if(!this.is_empty()) {
            this.actor.clutter_text.set_selection(0, this.text.length);
        }

        this.actor.grab_key_focus();
    },

    destroy: function() {
        this._google_entry_suggestions.destroy();
        this._secondary_icon.destroy();
        this.actor.destroy();
    },

    get text() {
        return !this.is_empty() ? this.actor.get_text() : '';
    }
});
