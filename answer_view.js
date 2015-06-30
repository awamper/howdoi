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
const Pango = imports.gi.Pango;
const Gtk = imports.gi.Gtk;

const AnswerView = new Lang.Class({
    Name: 'HowDoIAnswerView',

    _init: function(answer_text) {
        this.actor = new St.BoxLayout({
            reactive: true
        });

        this._entry = new St.Entry({
            style_class: 'howdoi-answer-view-entry'
        });
        this._clutter_text = this._entry.get_clutter_text();
        this._clutter_text.set_selectable(true);
        this._clutter_text.set_single_line_mode(false);
        this._clutter_text.set_activatable(false);
        this._clutter_text.set_line_wrap(true);
        this._clutter_text.set_line_wrap_mode(Pango.WrapMode.WORD_CHAR);
        this._clutter_text.set_max_length(0);

        this._box = new St.BoxLayout({
            vertical: true
        });
        this._box.add(this._entry, {
            y_align: St.Align.START,
            y_fill: false
        });

        this._scroll = new St.ScrollView({
            style_class: 'howdoi-answer-view'
        });
        this._scroll.set_policy(
            Gtk.PolicyType.NEVER,
            Gtk.PolicyType.AUTOMATIC
        );
        this._scroll.set_overlay_scrollbars(true);
        this._scroll.add_actor(this._box);

        this.actor.add(this._scroll, {
            x_fill: true,
            y_fill: true,
            expand: true
        });

        this.set_answer(answer_text);
    },

    set_answer: function(text) {
        this._entry.set_text(text);
    },

    set_width: function(width) {
        this._scroll.width = width;
    },

    set_height: function(height) {
        this._scroll.height = height;
    },

    destroy: function() {
        this.actor.destroy();
    }
});
