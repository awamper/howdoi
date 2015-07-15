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
const Gtk = imports.gi.Gtk;
const ExtensionUtils = imports.misc.extensionUtils;

const Me = ExtensionUtils.getCurrentExtension();
const Utils = Me.imports.utils;
const Answer = Me.imports.answer;
const TextBlockEntry = Me.imports.text_block_entry;

const AnswerView = new Lang.Class({
    Name: 'HowDoIAnswerView',

    _init: function(answer) {
        this.actor = new St.BoxLayout({
            reactive: true,
            vertical: true
        });

        this._answer = null;

        this._scroll = new St.ScrollView({
            style_class: 'howdoi-answer-view'
        });
        this._scroll.set_policy(
            Gtk.PolicyType.NEVER,
            Gtk.PolicyType.AUTOMATIC
        );
        this.actor.add(this._scroll, {
            x_fill: true,
            y_fill: true,
            expand: true
        });

        this.set_answer(answer);
    },

    set_answer: function(answer) {
        function dump_text() {
            if(Utils.is_blank(text_block)) return;

            let block = {
                type: Answer.BLOCK_TYPE.TEXT,
                content: text_block
            };
            let label = new TextBlockEntry.TextBlockEntry(block);
            box.add(label.actor, {
                expand: false,
                x_fill: false,
                y_fill: false,
                x_align: St.Align.START,
                y_align: St.Align.START
            });
            text_block = '';
        }

        this._answer = answer;

        let box = new St.BoxLayout({
            vertical: true
        });
        let title = new St.Label({
            style_class: 'howdoi-answer-view-title',
            text: 'Q: ' + this._answer.title
        });
        box.add(title, {
            x_fill: true,
            y_fill: false,
            expand: true,
            x_align: St.Align.START,
            y_align: St.Align.MIDDLE
        });

        let text_block = '';
        let text_blocks = answer.get_text_blocks();

        for each(let block in text_blocks) {
            if(block.type === Answer.BLOCK_TYPE.TEXT) {
                text_block += block.content;
                let is_last = (
                    text_blocks.indexOf(block) === text_blocks.length - 1
                );
                if(is_last) dump_text();
            }
            else if(block.type === Answer.BLOCK_TYPE.CODE) {
                let lines_count = block.content.split('\n').length;

                if(lines_count < 2) {
                    text_block += (
                        '<span bgcolor="#CCCCCC" fgcolor="#222222"><tt>' +
                        '%s</tt></span>'.format(block.content)
                    );
                }
                else {
                    dump_text();

                    let entry = new TextBlockEntry.TextBlockEntry(block);
                    box.add(entry.actor, {
                        expand: false,
                        x_fill: false,
                        y_fill: false,
                        x_align: St.Align.START,
                        y_align: St.Align.START
                    });
                }
            }
            else if(block.type === Answer.BLOCK_TYPE.BLOCKQUOTE) {
                dump_text();

                let entry = new TextBlockEntry.TextBlockEntry(block);
                box.add(entry.actor, {
                    expand: false,
                    x_fill: false,
                    y_fill: false,
                    x_align: St.Align.START,
                    y_align: St.Align.START
                });
            }
        }

        this._scroll.add_actor(box);
    },

    set_width: function(width) {
        this._scroll.width = width;
    },

    set_height: function(height) {
        this._scroll.height = height;
    },

    scroll_step_up: function() {
        let value = this._scroll.vscroll.adjustment.value;
        let step_increment = this._scroll.vscroll.adjustment.step_increment;

        if(value > 0) {
            this._scroll.vscroll.adjustment.value = value - step_increment;
        }
    },

    scroll_step_down: function() {
        let value = this._scroll.vscroll.adjustment.value;
        let step_increment = this._scroll.vscroll.adjustment.step_increment;
        let upper = this._scroll.vscroll.adjustment.upper;

        if(value < upper) {
            this._scroll.vscroll.adjustment.value = value + step_increment;
        }
    },

    destroy: function() {
        this._answer = null;
        this.actor.destroy();
    },

    get answer() {
        return this._answer;
    }
});
