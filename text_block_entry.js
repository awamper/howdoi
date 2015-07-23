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
const Gio = imports.gi.Gio;
const Clutter = imports.gi.Clutter;
const Pango = imports.gi.Pango;
const Meta = imports.gi.Meta;
const Signals = imports.signals;
const Tweener = imports.ui.tweener;
const Params = imports.misc.params;
const Main = imports.ui.main;
const ExtensionUtils = imports.misc.extensionUtils;
const Animation = imports.ui.animation;

const Me = ExtensionUtils.getCurrentExtension();
const Utils = Me.imports.utils;
const PrefsKeys = Me.imports.prefs_keys;
const Answer = Me.imports.answer;
const Tooltip = Me.imports.tooltip;
const Extension = Me.imports.extension;
const AnimatedLabel = Me.imports.animated_label;

const COPY_SELECTION_TIMEOUT_MS = 400;
const TIMEOUT_IDS = {
    SELECTION: 0
};
const LINK_TOOLTIP_MARKUP = (
    '<b>%s</b>\n' +
    '<small><i>Left-click to open url in the browser</i></small>\n' +
    '<small><i>Right-click to copy url to the clipboard</i></small>'
);

const LINKS_REGEXP = /\[a href="(.*?)"\](.*?)\[\/a\]/gi;

const LinkPopup = new Lang.Class({
    Name: 'HowDoIAnswerLinkPopup',
    Extends: Tooltip.Tooltip,

    set: function(link) {
        if(link !== null) {
            this._label.clutter_text.set_markup(
                LINK_TOOLTIP_MARKUP.format(link.url)
            );
        }
    }
});

const SpinnerBox = new Lang.Class({
    Name: 'HowDoISpinnerBox',

    _init: function() {
        this.actor = new St.BoxLayout();

        this._label = new St.Label({
            text: 'Loading...'
        });

        let spinner_icon = Gio.File.new_for_uri(
            'resource:///org/gnome/shell/theme/process-working.svg'
        );
        this._spinner = new Animation.AnimatedIcon(spinner_icon, 24);

        this.actor.add_child(this._spinner.actor);
        this.actor.add_child(this._label);
        this.actor.hide();
    },

    show: function() {
        this._spinner.play();
        this.actor.show();
    },

    hide: function() {
        this._spinner.stop();
        this.actor.hide();
    },

    destroy: function() {
        this.actor.destroy();
    }
});

const ImagePreviewer = new Lang.Class({
    Name: 'HowDoIImagePreviewer',
    Extends: Tooltip.Tooltip,

    _init: function() {
        this.parent();
        this._label.destroy();

        this._spinner = new SpinnerBox();
        this._image_box = new St.Bin();
        this.actor.add_child(this._spinner.actor);
        this.actor.add_child(this._image_box);
    },

    preview: function(uri) {
        if(uri === null) {
            this.hide();
            return;
        }

        this._spinner.show();
        this.show();

        let max_size = Utils.SETTINGS.get_int(PrefsKeys.MAX_IMAGE_SIZE);
        let image_file = Gio.file_new_for_uri(uri);
        let texture_cache = St.TextureCache.get_default();
        let scale_factor = St.ThemeContext.get_for_stage(
            global.stage
        ).scale_factor;
        let image = texture_cache.load_file_async(
            image_file,
            max_size,
            max_size,
            scale_factor
        );
        image.connect('size-change',
            Lang.bind(this, function() {
                this._spinner.hide();
                this.reposition();
            })
        );
        this._image_box.set_child(image);
    },

    _hide_done: function() {
        this._spinner.hide();
        if(this._image_box.child) this._image_box.child.destroy();
        this.parent();
    },

    destroy: function() {
        this._spinner.destroy();
        this.parent();
    }
});

const CopyButton = new Lang.Class({
    Name: 'HowDoiTextBlockEntryCopyButton',
    Extends: Tooltip.Tooltip,

    _init: function(entry) {
        this.parent();
        this.actor.destroy_all_children();

        this._entry = entry;
        this._entry.connect('leave-event',
            Lang.bind(this, function() {
                if(!Utils.is_pointer_inside_actor(this.actor)) {
                    this._entry.clutter_text.set_editable(false);
                    this.hide();
                }

                return Clutter.EVENT_PROPAGATE;
            })
        );
        this._entry.clutter_text.connect('key-focus-out',
            Lang.bind(this, this.hide)
        );

        this._label = new St.Label();
        this._button = new St.Button({
            child: this._label,
            style_class: 'howdoi-copy-button',
            reactive: true,
            track_hover: true
        });
        this._button.connect('clicked',
            Lang.bind(this, function() {
                this.hide();
                let selection = this._entry.clutter_text.get_selection();
                if(Utils.is_blank(selection)) return;

                St.Clipboard.get_default().set_text(
                    St.ClipboardType.CLIPBOARD,
                    selection
                );
            })
        );

        this.actor.add_child(this._button);
    },

    set_markup: function(markup) {
        this._label.clutter_text.set_markup(markup);
    },

    destroy: function() {
        this._entry = null;
        this.parent();
    }
});

const TextBlockEntry = new Lang.Class({
    Name: 'HowDoIAnswerTextBlockEntry',

    _init: function(text_block, params) {
        this.params = Params.parse(params, {
            track_links_hover: true
        });
        this.actor = new St.BoxLayout({
            vertical: false
        });
        this.actor.connect('destroy',
            Lang.bind(this, this._destroy)
        );
        this.actor.text_block = text_block;

        this._entry = new St.Entry({
            style_class: 'howdoi-answer-view-entry',
            reactive: true
        });
        this._entry.connect('leave-event',
            Lang.bind(this, function() {
                if(this._link_popup) this._link_popup.hide();
                if(this._image_previewer) this._image_previewer.hide();
            })
        );
        this._entry.connect('motion-event',
            Lang.bind(this, this._on_motion_event)
        );
        this.actor.add_child(this._entry);

        this._clutter_text = this._entry.get_clutter_text();
        this._clutter_text.set_selectable(true);
        this._clutter_text.set_editable(false);
        this._clutter_text.set_single_line_mode(false);
        this._clutter_text.set_activatable(false);
        this._clutter_text.set_line_wrap(true);
        this._clutter_text.set_max_length(0);
        this._clutter_text.set_line_wrap_mode(
            Pango.WrapMode.WORD_CHAR
        );
        this._clutter_text.set_ellipsize(
            Pango.EllipsizeMode.NONE
        );
        this._clutter_text.connect('cursor-changed',
            Lang.bind(this, this._on_cursor_changed)
        );
        this._clutter_text.connect('button-press-event',
            Lang.bind(this, function() {
                if(this._link_entered) return Clutter.EVENT_PROPAGATE;
                this._clutter_text.set_editable(true);
                return Clutter.EVENT_PROPAGATE;
            })
        );
        this._clutter_text.connect('button-release-event',
            Lang.bind(this, this._on_text_button_release_event)
        );

        this._copy_button = null;
        this._link_popup = null;
        this._image_previewer = null;
        this._link_entered = null;
        this._link_maps = [];

        this.connect('link-clicked',
            Lang.bind(this, function(sender, link, button) {
                if(this._link_popup) this._link_popup.hide();
                if(this._image_previewer) this._image_previewer.hide();
                if(Utils.is_blank(link.url)) return;

                if(button === Clutter.BUTTON_PRIMARY) {
                    Gio.app_info_launch_default_for_uri(
                        link.url,
                        Utils.make_launch_context()
                    );
                    Extension.howdoi.hide();
                }
                else {
                    let clipboard = St.Clipboard.get_default();
                    clipboard.set_text(
                        St.ClipboardType.CLIPBOARD,
                        link.url
                    );
                    AnimatedLabel.flash(link.url);
                }
            })
        );
        this.connect('link-enter',
            Lang.bind(this, function(sender, link) {
                if(link.title === Answer.IMAGE_TITLE) {
                    if(this._image_previewer === null) {
                        this._image_previewer = new ImagePreviewer();
                    }

                    this._image_previewer.preview(link.url);
                }
                else {
                    if(this._link_popup === null) {
                        this._link_popup = new LinkPopup();
                    }

                    this._link_popup.set(link);
                    this._link_popup.show();
                }
            })
        );
        this.connect('link-leave',
            Lang.bind(this, function(sender) {
                if(this._link_popup && this._link_popup.shown) {
                    this._link_popup.set(null);
                    this._link_popup.hide();
                }
                if(this._image_previewer && this._image_previewer.shown) {
                    this._image_previewer.preview(null);
                    this._image_previewer.hide();
                }
            })
        );

        this.set(text_block);
    },

    _on_cursor_changed: function() {
        this._remove_timeout();
        let selection = this._clutter_text.get_selection();

        if(Utils.is_blank(selection)) {
            if(this._copy_button) this._copy_button.hide();
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

                if(this._copy_button === null) {
                    this._copy_button = new CopyButton(this._entry);
                }

                this._copy_button.set_markup(label_markup);
                this._copy_button.show();

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

    _destroy: function() {
        this._link_entered = null;
        this._link_maps = [];
        this.actor.text_block = null;

        this._remove_timeout();

        if(this._image_previewer) {
            this._image_previewer.destroy();
            this._image_previewer = null;
        }
        if(this._link_popup) {
            this._link_popup.destroy();
            this._link_popup = null;
        }
        if(this._copy_button) {
            this._copy_button.destroy();
            this._copy_button = null;
        }

        this.actor.destroy();
    },

    _find_link_at_coords: function(event) {
        if(this._link_maps.length < 1) return -1;

        let result = -1;
        let [x, y] = event.get_coords();
        [success, x, y] = this._entry.transform_stage_point(x, y);
        if(!success) return result;

        for each(let link in this._link_maps) {
            let [success, url_start_x, url_start_y, line_height] =
                this._clutter_text.position_to_coords(link.start);
            let [end_success, url_end_x, url_end_y, end_line_height] =
                this._clutter_text.position_to_coords(link.stop);

            if(
                url_start_y > y
                || url_start_y + line_height < y
                || x < url_start_x
                || x > url_end_x
            ) {
                continue;
            }
            else {
                result = link;
                break;
            }
        }

        return result;
    },

    _on_motion_event: function(o, event) {
        let link = this._find_link_at_coords(event);

        if(link !== -1) {
            if(this._link_popup && this._link_popup.shown) {
                this._link_popup.reposition();
            }
            if(this._image_previewer && this._image_previewer.shown) {
                this._image_previewer.reposition();
            }

            global.screen.set_cursor(Meta.Cursor.POINTING_HAND);
            if(!this.params.track_links_hover) return Clutter.EVENT_PROPAGATE;

            if(this._link_entered === null) {
                this._link_entered = link;
                this.emit('link-enter', link);
            }
            else if(this._link_entered !== null && this._link_entered !== link) {
                this._link_entered = link;
                this.emit('link-leave');
                this.emit('link-enter', link);
            }

            return Clutter.EVENT_PROPAGATE;
        }
        else {
            global.screen.set_cursor(Meta.Cursor.DEFAULT);
            if(!this.params.track_links_hover) return Clutter.EVENT_PROPAGATE;

            if(this._link_entered) {
                this._link_entered = null;
                this.emit('link-leave');
            }

            return Clutter.EVENT_PROPAGATE;
        }
    },

    _on_text_button_release_event: function(o, event) {
        let button = event.get_button();
        let link = this._find_link_at_coords(event)
        if(link !== -1) this.emit('link-clicked', link, button);
        return Clutter.EVENT_PROPAGATE;
    },

    _parse_links: function(markup) {
        let link_maps = [];
        let match;
        let new_content = markup;
        let start_offset = 0;

        while((match = LINKS_REGEXP.exec(markup)) !== null) {
            let url = match[1].trim();
            let title = match[2];
            let link_markup =
                '<span foreground="#006AFF"><u>%s</u></span>'.format(title);

            let markup_offset = match.index - Utils.strip_tags(
                markup.slice(0, match.index)
            ).length;
            new_content = new_content.replace(match[0], link_markup);
            let map = {
                title: title,
                url: url,
                start: match.index - start_offset - markup_offset,
                stop: match.index + title.length - start_offset - markup_offset
            };
            start_offset += match[0].length - title.length;
            link_maps.push(map);
        }

        return [link_maps, new_content];
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

        [this._link_maps, markup] = this._parse_links(markup);

        if(!Utils.is_blank(color_bin.style)) {
            this.actor.insert_child_below(color_bin, this._entry)
        }

        markup = Utils.fix_markup(markup);

        try {
            Pango.parse_markup(markup, -1, '');
            this._clutter_text.set_markup(markup);
        }
        catch(e) {
            this._clutter_text.set_text(Utils.strip_tags(markup));
        }
    },

    get entry() {
        return this._entry;
    },

    get text() {
        return this._entry.get_text();
    }
});
Signals.addSignalMethods(TextBlockEntry.prototype);
