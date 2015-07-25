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
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const ExtensionUtils = imports.misc.extensionUtils;

const Me = ExtensionUtils.getCurrentExtension();
const Utils = Me.imports.utils;
const PrefsKeys = Me.imports.prefs_keys;
const Extension = Me.imports.extension;

const Indicator = new Lang.Class({
    Name: 'HowDoIIndicator',
    Extends: PanelMenu.Button,

    _init: function() {
        this.parent(0.0, 'howdoi');

        let icon = new St.Icon({
            icon_name: 'help-faq-symbolic',
            style_class: 'system-status-icon'
        });
        this.actor.add_child(icon);

        this._update_menu_items();
        Main.panel.addToStatusArea('howdoi', this);
    },

    _onEvent: function(actor, event) {
        if(event.type() === Clutter.EventType.BUTTON_RELEASE) {
            let button = event.get_button();

            switch(button) {
                case Clutter.BUTTON_SECONDARY:
                    this._update_menu_items();
                    this.menu.toggle();
                    break;
                case Clutter.BUTTON_MIDDLE:
                    break;
                default:
                    Extension.howdoi.show();
                    break;
            }

            return Clutter.EVENT_STOP;
        }
        else {
            return Clutter.EVENT_PROPOGATE;
        }
    },

    _markup_query: function(query) {
        let markup;
        let keyword = Extension.howdoi.get_keyword_for_query(query);

        if(keyword) {
            markup = (
                '<span fgcolor="#222222" bgcolor="#CCCCCC">' +
                '<b> %s </b></span> %s'.format(
                    Extension.howdoi._get_name_for_keyword(keyword),
                    query.slice(keyword.length)
                )
            );
        }
        else {
            markup = query;
        }

        return markup;
    },

    _update_menu_items: function() {
        this.menu.removeAll();

        let limit = Utils.SETTINGS.get_int(PrefsKeys.RECENT_LIMIT);
        let recent_searches =
            Extension.howdoi.search_entry.history.get_last();
        recent_searches.reverse();

        let filtered_searches = [];
        for each(let query in recent_searches) {
            if(filtered_searches.indexOf(query.trim()) !== -1) {
                continue;
            }

            filtered_searches.push(query.trim());
            if(filtered_searches.length >= limit) break;
        }

        if(filtered_searches.length === 0) {
            let empty_label = new PopupMenu.PopupMenuItem(
                'Search history is empty'
            );
            this.menu.addMenuItem(empty_label)
            empty_label.setSensitive(false);
        }
        else {
            for each(let query in filtered_searches) {
                let markup = this._markup_query(query);
                let item = new PopupMenu.PopupMenuItem('');
                item.label.clutter_text.set_markup(markup);
                item.query = query;
                item.connect('activate',
                    Lang.bind(this, function() {
                        Extension.howdoi.ignore_change = true;
                        Extension.howdoi.search_entry.suggestions.ignore_change = true;
                        Extension.howdoi.search_entry.set_text(item.query);
                        Extension.howdoi.answers_view.clear();
                        Extension.howdoi.show();
                        Extension.howdoi.show_cache_or_search();
                    })
                );
                this.menu.addMenuItem(item);
            }
        }

        let clipboard = St.Clipboard.get_default();
        clipboard.get_text(St.ClipboardType.CLIPBOARD,
            Lang.bind(this, function(clipboard, text) {
                let label;
                let sensitive = true;

                if(Utils.is_blank(text)) {
                    label = 'Clipboard is empty'
                    sensitive = false;
                }
                else {
                    label = (
                        'Search from clipboard ' +
                        '<sup><small>%s</small></sup>'
                    );
                    label = label.format(text.length + ' chars');
                }

                let separator = new PopupMenu.PopupSeparatorMenuItem();
                this.menu.addMenuItem(separator);

                let item = new PopupMenu.PopupMenuItem('');
                item.label.clutter_text.set_markup(label);
                item.connect('activate',
                    Lang.bind(this, function() {
                        Extension.howdoi.search_entry.history.add(text);
                        Extension.howdoi.ignore_change = true;
                        Extension.howdoi.search_entry.suggestions.ignore_change = true;
                        Extension.howdoi.search_entry.set_text(text);
                        Extension.howdoi.answers_view.clear();
                        Extension.howdoi.show();
                        Extension.howdoi._search(text);
                    })
                );
                this.menu.addMenuItem(item)
                item.setSensitive(sensitive);

                separator = new PopupMenu.PopupSeparatorMenuItem();
                this.menu.addMenuItem(separator);

                let preferences_item = new PopupMenu.PopupMenuItem('Preferences');
                preferences_item.connect('activate', Lang.bind(this, function() {
                    Utils.launch_extension_prefs(Me.uuid);
                    Extension.howdoi.hide();
                }));
                this.menu.addMenuItem(preferences_item);
            })
        );
    },

    destroy: function() {
        delete Main.panel.statusArea['howdoi'];
        this.parent();
    }
});
