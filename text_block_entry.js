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
const GLib = imports.gi.GLib;
const Clutter = imports.gi.Clutter;
const Pango = imports.gi.Pango;
const Tweener = imports.ui.tweener;
const Main = imports.ui.main;
const ExtensionUtils = imports.misc.extensionUtils;

const Me = ExtensionUtils.getCurrentExtension();
const Utils = Me.imports.utils;
const Answer = Me.imports.answer;
const PopupDialog = Me.imports.popup_dialog;

const COPY_SELECTION_TIMEOUT_MS = 400;
const TIMEOUT_IDS = {
    SELECTION: 0
};

const TextBlockEntry = new Lang.Class({
    Name: 'HowDoIAnswerTextBlockEntry',

    _init: function(text_block) {
        this.actor = new St.BoxLayout({
            vertical: false
        });
        this.actor.connect('destroy',
            Lang.bind(this, this._destroy)
        );

        this._entry = new St.Entry({
            style_class: 'howdoi-answer-view-entry'
        });
        this._entry.connect('enter-event',
            Lang.bind(this, function() {
                this._clutter_text.set_selectable(true);
                this._clutter_text.set_editable(true);
            })
        );
        this._entry.connect('leave-event',
            Lang.bind(this, function() {
                if(!Utils.is_pointer_inside_actor(this._copy_button)) {
                    this._clutter_text.set_selectable(false);
                    this._clutter_text.set_editable(false);
                    this._hide_button();
                }
            })
        );
        this.actor.add_child(this._entry);

        this._clutter_text = this._entry.get_clutter_text();
        this._clutter_text.set_selectable(false);
        this._clutter_text.set_editable(false);
        this._clutter_text.set_single_line_mode(false);
        this._clutter_text.set_activatable(false);
        this._clutter_text.set_line_wrap(true);
        this._clutter_text.set_max_length(0);
        this._clutter_text.set_line_wrap_mode(
            Pango.WrapMode.WORD_CHAR
        );
        this._clutter_text.connect('cursor-changed',
            Lang.bind(this, this._on_cursor_changed)
        );
        this._clutter_text.connect('key-focus-out',
            Lang.bind(this, this._hide_button)
        );

        this._copy_label = new St.Label();
        this._copy_button = new St.Button({
            child: this._copy_label,
            style_class: 'howdoi-copy-button',
            visible: false
        });
        this._copy_button.connect('clicked',
            Lang.bind(this, function() {
                this._hide_button();
                let selection = this._clutter_text.get_selection();
                if(Utils.is_blank(selection)) return;

                St.Clipboard.get_default().set_text(
                    St.ClipboardType.CLIPBOARD,
                    selection
                );
            })
        );
        Main.uiGroup.add_child(this._copy_button);

        this.set(text_block);
    },

    _on_cursor_changed: function() {
        this._remove_timeout();
        let selection = this._clutter_text.get_selection();

        if(Utils.is_blank(selection)) {
            this._hide_button();
            return Clutter.EVENT_STOP;
        }

        TIMEOUT_IDS.SELECTION = Mainloop.timeout_add(
            COPY_SELECTION_TIMEOUT_MS,
            Lang.bind(this, function() {
                this._remove_timeout();

                let label_markup =(
                    '<b>copy selection</b>\n' +
                    '<span font-size="x-small">(%s lines, %s symbols)</span>'.format(
                        selection.split('\n').length,
                        selection.length
                    )
                );
                this._copy_label.clutter_text.set_markup(label_markup);
                this._show_button();
                return GLib.SOURCE_REMOVE;
            })
        );

        return Clutter.EVENT_STOP;
    },

    _remove_timeout: function() {
        if(TIMEOUT_IDS.SELECTION > 0) {
            Mainloop.source_remove(TIMEOUT_IDS.SELECTION);
            TIMEOUT_IDS.SELECTION = 0;
        }
    },

    _show_button: function() {
        if(this._copy_button.visible) return;

        Main.uiGroup.set_child_above_sibling(this._copy_button, null);
        let [pointer_x, pointer_y] = global.get_pointer();
        this._copy_button.translation_x = pointer_x + 5;
        this._copy_button.translation_y = pointer_y + 5;

        this._copy_button.set_pivot_point(0.5, 1.0);
        this._copy_button.scale_x = 0.01;
        this._copy_button.scale_y = 0.05;
        this._copy_button.show();

        Tweener.removeTweens(this._copy_button);
        Tweener.addTween(this._copy_button, {
            time: 0.2,
            scale_x: 1.1,
            scale_y: 1.1,
            transition: 'easeOutQuad',
            onComplete: Lang.bind(this, function() {
                Tweener.addTween(this._copy_button, {
                    time: 0.2,
                    scale_x: 1,
                    scale_y: 1,
                    transition: 'easeOutQuad'
                });
            })
        });
    },

    _hide_button: function() {
        if(!this._copy_button.visible) return;

        this._copy_button.set_pivot_point(0.5, 0.5);
        Tweener.removeTweens(this._copy_button);
        Tweener.addTween(this._copy_button, {
            time: 0.1,
            scale_x: 1.1,
            scale_y: 1.1,
            transition: 'easeOutQuad',
            onComplete: Lang.bind(this, function() {
                Tweener.addTween(this._copy_button, {
                    time: 0.2,
                    opacity: 0,
                    scale_x: 0,
                    scale_y: 0,
                    transition: 'easeOutQuad',
                    onComplete: Lang.bind(this, function() {
                        this._copy_button.hide();
                        this._copy_button.opacity = 255;
                        this._copy_button.scale_x = 1;
                        this._copy_button.scale_y = 1;
                    })
                });
            })
        });
    },

    _destroy: function() {
        this._remove_timeout();
        this._copy_button.destroy();
        this.actor.destroy();
    },

    set: function(text_block) {
        let color_bin = new St.Bin({
            width: 5
        });
        let markup = text_block.content.replace(/^[\n]{1,}/g, '\n');
        markup = markup.replace(/[\n]{1,}$/g, '\n');

        if(text_block.type === Answer.BLOCK_TYPE.CODE) {
            color_bin.style = 'background-color: #006AFF;'
            markup = '<tt>%s</tt>'.format(markup);
            this._entry.add_style_pseudo_class('code');
        }
        else if(text_block.type === Answer.BLOCK_TYPE.BLOCKQUOTE) {
            color_bin.style = 'background-color: #FFB62E;'
            this._entry.add_style_pseudo_class('blockquote');
        }
        else {
            // nothing
        }

        if(!Utils.is_blank(color_bin.style)) {
            this.actor.insert_child_below(color_bin, this._entry)
        }

        this._clutter_text.set_markup(markup);
    },

    get entry() {
        return this._entry;
    },

    get text() {
        return this._entry.get_text();
    }
});
