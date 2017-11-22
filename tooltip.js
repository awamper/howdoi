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
const ExtensionUtils = imports.misc.extensionUtils;

const Me = ExtensionUtils.getCurrentExtension();
const PopupDialog = Me.imports.popup_dialog;


var Tooltip = new Lang.Class({
    Name: 'HowDoIAnswerTooltip',
    Extends: PopupDialog.PopupDialog,

    _init: function() {
        this.parent({
            modal: false,
            style_class: 'howdoi-answer-tooltip'
        });

        this._label = new St.Label();
        this.actor.add_child(this._label);
    },

    _reposition: function() {
        this.parent();
        this.actor.y = this.actor.y + 15;
    },

    _show_done: function() {
        this.parent();
        this._reposition();
    },

    reposition: function() {
        this._reposition();
    },

    set: function(text) {
        this._label.set_text(text);
    },

    set_markup: function(markup) {
        this._label.clutter_text.set_markup(markup);
    }
});
