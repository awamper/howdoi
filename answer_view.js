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
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const Meta = imports.gi.Meta;
const Main = imports.ui.main;
const ExtensionUtils = imports.misc.extensionUtils;

const Me = ExtensionUtils.getCurrentExtension();
const Utils = Me.imports.utils;
const PrefsKeys = Me.imports.prefs_keys;
const Answer = Me.imports.answer;
const TextBlockEntry = Me.imports.text_block_entry;
const Extension = Me.imports.extension;
const Constants = Me.imports.constants;

const QuestionTitle = new Lang.Class({
    Name: 'HowDoIQuestionTitle',

    _init: function(answer) {
        this.actor = new St.BoxLayout();

        this._label = new St.Label({
            style_class: 'howdoi-answer-view-title',
            reactive: true
        });
        this._label.connect('enter-event',
            Lang.bind(this, function() {
                global.screen.set_cursor(Meta.Cursor.POINTING_HAND);
            })
        );
        this._label.connect('leave-event',
            Lang.bind(this, function() {
                global.screen.set_cursor(Meta.Cursor.DEFAULT);
            })
        );
        this._label.connect('button-release-event',
            Lang.bind(this, function() {
                Gio.app_info_launch_default_for_uri(
                    answer.share_link,
                    Utils.make_launch_context()
                );
                Extension.howdoi.hide();
            })
        );
        this.actor.add(this._label, {
            x_fill: false,
            y_fill: false,
            expand: false,
            x_align: St.Align.START,
            y_align: St.Align.MIDDLE
        });

        this.set_title(answer.title);
    },

    set_title: function(title) {
        this._label.set_text('Q: ' + title);
    }
});

const CopyBlockButton = new Lang.Class({
    Name: 'HowDoIAnswerCopyBlockButton',

    _init: function(answer_view, text_block_entry) {
        let icon = new St.Icon({
            icon_name: 'edit-copy-symbolic',
            icon_size: 30
        });
        this.actor = new St.Button({
            child: icon,
            visible: false,
            style_class: 'howdoi-copy-block-button'
        });
        this.actor.connect('clicked',
            Lang.bind(this, function() {
                St.Clipboard.get_default().set_text(
                    St.ClipboardType.CLIPBOARD,
                    text_block_entry.text
                );
            })
        );

        this._connection_ids = {
            ENTRY_ENTER: 0,
            ENTRY_LEAVE: 0,
            SCROLL: 0
        };
        this._block_entry = text_block_entry;
        this._answer_view = answer_view;
        this._v_adjustment = this._answer_view.scroll.vscroll.adjustment;

        this._connection_ids.ENTRY_ENTER =
            this._block_entry.entry.connect(
                'enter-event',
                Lang.bind(this, this.show_or_hide)
            );
        this._connection_ids.ENTRY_LEAVE =
            this._block_entry.entry.connect(
                'leave-event',
                Lang.bind(this, function() {
                    if(!Utils.is_pointer_inside_actor(this.actor)) {
                        this.hide();
                    }
                })
            );
        this._connection_ids.SCROLL =
            this._v_adjustment.connect(
                'notify::value',
                Lang.bind(this, this.show_or_hide)
            );

        Main.uiGroup.add_child(this.actor);
    },

    _reposition: function() {
        let margin = 10;
        let [x, y] = this._block_entry.actor.get_transformed_position();
        this.actor.x = (
            this._block_entry.actor.width +
            x - this.actor.width - margin
        );
        this.actor.y = y + margin;
    },

    show: function() {
        this.actor.show();
        this._reposition();
        Main.uiGroup.set_child_above_sibling(this.actor, null);
    },

    hide: function() {
        if(!this.actor.visible) return;
        this.actor.hide();
    },

    show_or_hide: function() {
        let [answer_x, answer_y] =
            this._answer_view.actor.get_transformed_position();
        let [block_x, block_y] =
            this._block_entry.actor.get_transformed_position();

        if(!Utils.is_pointer_inside_actor(this._block_entry.entry)) this.hide();
        else if(block_y > answer_y) this.show();
        else this.hide();
    },

    destroy: function() {
        if(this._connection_ids.ENTRY_ENTER > 0) {
            this._block_entry.entry.disconnect(this._connection_ids.ENTRY_ENTER);
            this._connection_ids.ENTRY_ENTER = 0;
        }
        if(this._connection_ids.ENTRY_LEAVE > 0) {
            this._block_entry.entry.disconnect(this._connection_ids.ENTRY_LEAVE);
            this._connection_ids.ENTRY_LEAVE = 0;
        }
        if(this._connection_ids.SCROLL > 0) {
            this._v_adjustment.disconnect(this._connection_ids.SCROLL);
            this._connection_ids.SCROLL = 0;
        }

        this._block_entry = null;
        this._v_adjustment = null;
        this._answer_view = null;
        this.actor.destroy();
    }
});

const AnswerView = new Lang.Class({
    Name: 'HowDoIAnswerView',

    _init: function(answer) {
        this.actor = new St.BoxLayout({
            reactive: true,
            vertical: true
        });

        this._answer = null;
        this._copy_buttons = [];

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
        this._connection_id = Extension.howdoi.connect('closing',
            Lang.bind(this, this._hide_copy_buttons)
        );
    },

    _destroy_copy_buttons: function() {
        for each(let b in this._copy_buttons) b.destroy();
        this._copy_buttons = [];
    },

    _hide_copy_buttons: function() {
        for each(let b in this._copy_buttons) b.hide();
    },

    _count_code_blocks: function(text_blocks) {
        let result = 0;

        for each(let block in text_blocks) {
            if(block.type !== Answer.BLOCK_TYPE.CODE) continue;

            let lines_count = block.content.split('\n').length;
            if(lines_count > 1) result++;
        }

        return result;
    },

    _dump_block: function(box, block) {
        let view_mode = Utils.SETTINGS.get_int(PrefsKeys.ANSWER_VIEW_MODE);
        let code_blocks_count = this._count_code_blocks(
            this.answer.get_text_blocks()
        );

        if(Utils.is_blank(block.content)) return;
        if(
            view_mode !== Constants.ANSWER_VIEW_MODE.ALL &&
            (
                block.type === Answer.BLOCK_TYPE.TEXT ||
                block.type === Answer.BLOCK_TYPE.BLOCKQUOTE
            ) && code_blocks_count > 0
        ) return;

        let entry = new TextBlockEntry.TextBlockEntry(block);
        box.add(entry.actor, {
            expand: false,
            x_fill: false,
            y_fill: false,
            x_align: St.Align.START,
            y_align: St.Align.START
        });

        if(block.type === Answer.BLOCK_TYPE.CODE) {
            this._copy_buttons.push(new CopyBlockButton(this, entry));
        }

        block.content = '';
        block.links = [];
    },

    set_answer: function(answer) {
        let view_mode = Utils.SETTINGS.get_int(PrefsKeys.ANSWER_VIEW_MODE);
        this._answer = answer;

        let box = new St.BoxLayout({
            vertical: true
        });

        if(Utils.SETTINGS.get_boolean(PrefsKeys.QUESTION_TITLE)) {
            let title = new QuestionTitle(this._answer);
            box.add(title.actor, {
                x_fill: true,
                y_fill: false,
                expand: true,
                x_align: St.Align.START,
                y_align: St.Align.MIDDLE
            });
        }

        let text_block = {
            type: Answer.BLOCK_TYPE.TEXT,
            content: ''
        };
        let code_block = {
            type: Answer.BLOCK_TYPE.CODE,
            content: ''
        };

        let text_blocks = answer.get_text_blocks();
        let code_blocks_count = this._count_code_blocks(text_blocks);

        for each(let block in text_blocks) {
            if(block.type === Answer.BLOCK_TYPE.TEXT) {
                text_block.content += block.content;
                let is_last = (
                    text_blocks.indexOf(block) === text_blocks.length - 1
                );
                if(is_last) this._dump_block(box, text_block);
            }
            else if(block.type === Answer.BLOCK_TYPE.CODE) {
                let lines_count = block.content.split('\n').length;

                if(lines_count < 2) {
                    text_block.content += (
                        '<span bgcolor="#CCCCCC" fgcolor="#222222"><tt>' +
                        '%s</tt></span>'.format(block.content)
                    );
                }
                else {
                    this._dump_block(box, text_block);

                    if(view_mode === Constants.ANSWER_VIEW_MODE.ONLY_CODE) {
                        code_block.content += block.content;
                        continue;
                    }

                    let entry = new TextBlockEntry.TextBlockEntry(block);
                    this._copy_buttons.push(new CopyBlockButton(this, entry));
                    box.add(entry.actor, {
                        expand: false,
                        x_fill: false,
                        y_fill: false,
                        x_align: St.Align.START,
                        y_align: St.Align.START
                    });

                    if(view_mode === Constants.ANSWER_VIEW_MODE.FIRST_CODE) break;
                }
            }
            else if(block.type === Answer.BLOCK_TYPE.BLOCKQUOTE) {
                if(
                    view_mode !== Constants.ANSWER_VIEW_MODE.ALL &&
                    code_blocks_count > 0
                ) continue;

                this._dump_block(box, text_block);

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

        this._dump_block(box, code_block);
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
        Extension.howdoi.disconnect(this._connection_id);
        this._connection_id = 0;
        this._destroy_copy_buttons();
        this._answer = null;
        this.actor.destroy();
    },

    get answer() {
        return this._answer;
    },

    get scroll() {
        return this._scroll;
    }
});
