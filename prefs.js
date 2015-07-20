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

const Lang = imports.lang;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const Params = imports.misc.params;
const ExtensionUtils = imports.misc.extensionUtils;

const Me = ExtensionUtils.getCurrentExtension();
const PrefsKeys = Me.imports.prefs_keys;
const Utils = Me.imports.utils;
const Constants = Me.imports.constants;
const StackExchangeSites = Me.imports.stackexchange_sites;

const KeybindingsWidget = new GObject.Class({
    Name: 'Keybindings.Widget',
    GTypeName: 'KeybindingsWidget',
    Extends: Gtk.Box,

    _init: function(keybindings) {
        this.parent();
        this.set_orientation(Gtk.Orientation.VERTICAL);

        this._keybindings = keybindings;

        let scrolled_window = new Gtk.ScrolledWindow();
        scrolled_window.set_policy(
            Gtk.PolicyType.AUTOMATIC,
            Gtk.PolicyType.AUTOMATIC
        );

        this._columns = {
            NAME: 0,
            ACCEL_NAME: 1,
            MODS: 2,
            KEY: 3
        };

        this._store = new Gtk.ListStore();
        this._store.set_column_types([
            GObject.TYPE_STRING,
            GObject.TYPE_STRING,
            GObject.TYPE_INT,
            GObject.TYPE_INT
        ]);

        this._tree_view = new Gtk.TreeView({
            model: this._store,
            hexpand: true,
            vexpand: true
        });
        this._tree_view.get_selection().set_mode(Gtk.SelectionMode.SINGLE);

        let action_renderer = new Gtk.CellRendererText();
        let action_column = new Gtk.TreeViewColumn({
            'title': 'Action',
            'expand': true
        });
        action_column.pack_start(action_renderer, true);
        action_column.add_attribute(action_renderer, 'text', 1);
        this._tree_view.append_column(action_column);

        let keybinding_renderer = new Gtk.CellRendererAccel({
            'editable': true,
            'accel-mode': Gtk.CellRendererAccelMode.GTK
        });
        keybinding_renderer.connect('accel-edited',
            Lang.bind(this, function(renderer, iter, key, mods) {
                let value = Gtk.accelerator_name(key, mods);
                let [success, iterator ] =
                    this._store.get_iter_from_string(iter);

                if(!success) {
                    printerr("Can't change keybinding");
                }

                let name = this._store.get_value(iterator, 0);

                this._store.set(
                    iterator,
                    [this._columns.MODS, this._columns.KEY],
                    [mods, key]
                );
                Utils.SETTINGS.set_strv(name, [value]);
            })
        );

        let keybinding_column = new Gtk.TreeViewColumn({
            'title': 'Modify'
        });
        keybinding_column.pack_end(keybinding_renderer, false);
        keybinding_column.add_attribute(
            keybinding_renderer,
            'accel-mods',
            this._columns.MODS
        );
        keybinding_column.add_attribute(
            keybinding_renderer,
            'accel-key',
            this._columns.KEY
        );
        this._tree_view.append_column(keybinding_column);

        scrolled_window.add(this._tree_view);
        this.add(scrolled_window);

        this._refresh();
    },

    _refresh: function() {
        this._store.clear();

        for(let settings_key in this._keybindings) {
            let [key, mods] = Gtk.accelerator_parse(
                Utils.SETTINGS.get_strv(settings_key)[0]
            );

            let iter = this._store.append();
            this._store.set(iter,
                [
                    this._columns.NAME,
                    this._columns.ACCEL_NAME,
                    this._columns.MODS,
                    this._columns.KEY
                ],
                [
                    settings_key,
                    this._keybindings[settings_key],
                    mods,
                    key
                ]
            );
        }
    }
});

const KeywordsWidget = new GObject.Class({
    Name: 'Keywords.Widget',
    GTypeName: 'KeywordsWidget',
    Extends: Gtk.Box,

    _init: function(sites_list, settings_key) {
        this.parent();
        this.set_orientation(Gtk.Orientation.VERTICAL);

        this._sites_list = sites_list;
        this._settings_key = settings_key;
        this._keywords = JSON.parse(
            Utils.SETTINGS.get_string(settings_key)
        );

        let scrolled_window = new Gtk.ScrolledWindow();
        scrolled_window.set_policy(
            Gtk.PolicyType.AUTOMATIC,
            Gtk.PolicyType.AUTOMATIC
        );

        this._columns = {
            name: 0,
            keyword: 1
        };

        this._store = new Gtk.ListStore();
        this._store.set_column_types([
            GObject.TYPE_STRING,
            GObject.TYPE_STRING
        ]);

        this._tree_view = new Gtk.TreeView({
            model: this._store,
            hexpand: true,
            vexpand: true
        });
        this._tree_view.get_selection().set_mode(Gtk.SelectionMode.SINGLE);

        let name_renderer = new Gtk.CellRendererText();
        let name_column = new Gtk.TreeViewColumn({
            title: 'Site name',
            expand: true
        });
        name_column.pack_start(name_renderer, true);
        name_column.add_attribute(name_renderer, 'text', this._columns.name);
        this._tree_view.append_column(name_column);

        let keyword_renderer = new Gtk.CellRendererText({
            editable: true,
            placeholder_text: 'No keyword'
        });
        keyword_renderer.connect('edited',
            Lang.bind(this, function(renderer, path, new_keyword) {
                let [success, iterator ] =
                    this._store.get_iter_from_string(path);
                if(!success) {
                    this._show_message(
                        'Can\'t change keyword.',
                        Gtk.MessageType.ERROR
                    );
                    return;
                }

                new_keyword = new_keyword.trim();
                if(Utils.is_blank(new_keyword)) {
                    this._show_message(
                        'Keyword can\'t be empty.',
                        Gtk.MessageType.ERROR
                    );
                    return;
                }
                if(this.has_keyword(new_keyword)) {
                    this._show_message(
                        'Keyword already exist.',
                        Gtk.MessageType.ERROR
                    );
                    return;
                }

                let site_name = this._store.get_value(iterator, 0);
                this._store.set(
                    iterator,
                    [this._columns.name, this._columns.keyword],
                    [site_name, new_keyword]
                );
                this._save_keyword(site_name, new_keyword);
            })
        );

        let keyword_column = new Gtk.TreeViewColumn({
            title: 'Keyword'
        });
        keyword_column.pack_end(keyword_renderer, false);
        keyword_column.add_attribute(keyword_renderer, 'text', this._columns.keyword);
        this._tree_view.append_column(keyword_column);

        scrolled_window.add(this._tree_view);
        this.add(scrolled_window);

        this._refresh();
    },

    _refresh: function() {
        this._store.clear();

        for each(let site in this._sites_list) {
            let iter = this._store.append();
            this._store.set(iter,
                [this._columns.name, this._columns.keyword],
                [site.name, this._keywords[site.name] || '']
            );
        }
    },

    _show_message: function(text, type) {
        printerr(type);
        let dialog = new Gtk.MessageDialog({
            parent: this,
            message_type: type,
            buttons: Gtk.ButtonsType.OK,
            text: text
        });
        dialog.run();
        dialog.destroy();
    },

    _save_keyword: function(site_name, keyword) {
        this._keywords[site_name] = keyword;
        Utils.SETTINGS.set_string(
            this._settings_key,
            JSON.stringify(this._keywords)
        );
    },

    has_keyword: function(keyword) {
        for(let site_name in this._keywords) {
            if(this._keywords[site_name] === keyword) {
                return true;
            }
        }

        return false;
    }
});

const PrefsGrid = new GObject.Class({
    Name: 'Prefs.Grid',
    GTypeName: 'PrefsGrid',
    Extends: Gtk.Grid,

    _init: function(settings, params) {
        this.parent(params);
        this._settings = settings;
        this.margin = this.row_spacing = this.column_spacing = 10;
        this._rownum = 0;
    },

    add_entry: function(text, key) {
        let item = new Gtk.Entry({
            hexpand: false
        });
        item.text = this._settings.get_string(key);
        this._settings.bind(key, item, 'text', Gio.SettingsBindFlags.DEFAULT);

        return this.add_row(text, item);
    },

    add_shortcut: function(text, settings_key) {
        let item = new Gtk.Entry({
            hexpand: false
        });
        item.set_text(this._settings.get_strv(settings_key)[0]);
        item.connect('changed', Lang.bind(this, function(entry) {
            let [key, mods] = Gtk.accelerator_parse(entry.get_text());

            if(Gtk.accelerator_valid(key, mods)) {
                let shortcut = Gtk.accelerator_name(key, mods);
                this._settings.set_strv(settings_key, [shortcut]);
            }
        }));

        return this.add_row(text, item);
    },

    add_boolean: function(text, key) {
        let item = new Gtk.Switch({
            active: this._settings.get_boolean(key)
        });
        this._settings.bind(key, item, 'active', Gio.SettingsBindFlags.DEFAULT);

        return this.add_row(text, item);
    },

    add_combo: function(text, key, list, type) {
        let item = new Gtk.ComboBoxText();

        for(let i = 0; i < list.length; i++) {
            let title = list[i].title.trim();
            let id = list[i].value.toString();
            item.insert(-1, id, title);
        }

        if(type === 'string') {
            item.set_active_id(this._settings.get_string(key));
        }
        else {
            item.set_active_id(this._settings.get_int(key).toString());
        }

        item.connect('changed', Lang.bind(this, function(combo) {
            let value = combo.get_active_id();

            if(type === 'string') {
                if(this._settings.get_string(key) !== value) {
                    this._settings.set_string(key, value);
                }
            }
            else {
                value = parseInt(value, 10);

                if(this._settings.get_int(key) !== value) {
                    this._settings.set_int(key, value);
                }
            }
        }));

        return this.add_row(text, item);
    },

    add_spin: function(label, key, adjustment_properties, type, spin_properties) {
        adjustment_properties = Params.parse(adjustment_properties, {
            lower: 0,
            upper: 100,
            step_increment: 100
        });
        let adjustment = new Gtk.Adjustment(adjustment_properties);

        spin_properties = Params.parse(spin_properties, {
            adjustment: adjustment,
            numeric: true,
            snap_to_ticks: true
        }, true);
        let spin_button = new Gtk.SpinButton(spin_properties);

        if(type !== 'int') spin_button.set_digits(2);

        let get_method = type === 'int' ? 'get_int' : 'get_double';
        let set_method = type === 'int' ? 'set_int' : 'set_double';

        spin_button.set_value(this._settings[get_method](key));
        spin_button.connect('value-changed', Lang.bind(this, function(spin) {
            let value

            if(type === 'int') value = spin.get_value_as_int();
            else value = spin.get_value();

            if(this._settings[get_method](key) !== value) {
                this._settings[set_method](key, value);
            }
        }));

        return this.add_row(label, spin_button, true);
    },

    add_row: function(text, widget, wrap) {
        let label = new Gtk.Label({
            label: text,
            hexpand: true,
            halign: Gtk.Align.START
        });
        label.set_line_wrap(wrap || false);

        this.attach(label, 0, this._rownum, 1, 1); // col, row, colspan, rowspan
        this.attach(widget, 1, this._rownum, 1, 1);
        this._rownum++;

        return widget;
    },

    add_item: function(widget, col, colspan, rowspan) {
        this.attach(
            widget,
            col || 0,
            this._rownum,
            colspan || 2,
            rowspan || 1
        );
        this._rownum++;

        return widget;
    },

    add_range: function(label, key, range_properties) {
        range_properties = Params.parse(range_properties, {
            min: 0,
            max: 100,
            step: 10,
            mark_position: 0,
            add_mark: false,
            size: 200,
            draw_value: true
        });

        let range = Gtk.Scale.new_with_range(
            Gtk.Orientation.HORIZONTAL,
            range_properties.min,
            range_properties.max,
            range_properties.step
        );
        range.set_value(this._settings.get_int(key));
        range.set_draw_value(range_properties.draw_value);

        if(range_properties.add_mark) {
            range.add_mark(
                range_properties.mark_position,
                Gtk.PositionType.BOTTOM,
                null
            );
        }

        range.set_size_request(range_properties.size, -1);

        range.connect('value-changed', Lang.bind(this, function(slider) {
            this._settings.set_int(key, slider.get_value());
        }));

        return this.add_row(label, range, true);
    },

    add_separator: function() {
        let separator = new Gtk.Separator({
            orientation: Gtk.Orientation.HORIZONTAL
        });

        this.add_item(separator, 0, 2, 1);
    },
});

const HowDoIPrefsWidget = new GObject.Class({
    Name: 'HowDoI.Prefs.Widget',
    GTypeName: 'HowDoIPrefsWidget',
    Extends: Gtk.Box,

    _init: function(params) {
        this.parent(params);
        this.set_orientation(Gtk.Orientation.VERTICAL);

        let main = this._get_main_page();
        let size = this._get_size_page();
        let keywords = this._get_keywords_page();
        let keybindings = this._get_keybindings_page();

        let stack = new Gtk.Stack({
            transition_type: Gtk.StackTransitionType.SLIDE_LEFT_RIGHT,
            transition_duration: 500
        });
        let stack_switcher = new Gtk.StackSwitcher({
            margin_left: 5,
            margin_top: 5,
            margin_bottom: 5,
            margin_right: 5,
            stack: stack
        });

        stack.add_titled(main.page, main.name, main.name);
        stack.add_titled(size.page, size.name, size.name);
        stack.add_titled(keywords.page, keywords.name, keywords.name);
        stack.add_titled(keybindings.page, keybindings.name, keybindings.name);

        this.add(stack);

        this.connect('realize',
            Lang.bind(this, function() {
                let headerbar = this.get_toplevel().get_titlebar();
                headerbar.set_custom_title(stack_switcher);
                headerbar.show_all();
            })
        );
    },

    _get_main_page: function() {
        let name = 'Main';
        let page = new PrefsGrid(Utils.SETTINGS);

        let sites = [];
        for (let i = 0; i < StackExchangeSites.LIST.length; i++) {
            sites.push({
                title: StackExchangeSites.LIST[i].name,
                value: i
            });
        }
        page.add_combo(
            'Default site:',
            PrefsKeys.DEFAULT_SITE_ID,
            sites,
            'int'
        );

        page.add_separator();

        page.add_boolean(
            'Suggestions:',
            PrefsKeys.ENABLE_SUGGESTIONS
        );
        page.add_boolean(
            'Google Calculator:',
            PrefsKeys.ENABLE_CALCULATOR
        );
        page.add_separator();

        page.add_boolean(
            'Use Google search:',
            PrefsKeys.USE_GOOGLE_SEARCH
        );
        page.add_separator();

        let modes = [];
        for each(let mode in Constants.ANSWER_VIEW_MODE) {
            modes.push({
                title: Constants.ANSWER_VIEW_MODE_NAME[mode],
                value: mode
            });
        }
        let combo = page.add_combo(
            'Answer view mode:',
            PrefsKeys.ANSWER_VIEW_MODE,
            modes,
            'int'
        );

        let spin_properties = {
            lower: 1,
            upper: 10,
            step_increment: 1
        };
        page.add_spin(
            'Max answers:',
            PrefsKeys.MAX_ANSWERS,
            spin_properties,
            'int'
        );

        spin_properties.lower = 100;
        spin_properties.upper = 1000;
        spin_properties.step_increment = 50;
        page.add_spin(
            'Max image size(px):',
            PrefsKeys.MAX_IMAGE_SIZE,
            spin_properties,
            'int'
        );

        page.add_boolean(
            'Show question title:',
            PrefsKeys.QUESTION_TITLE
        );
        page.add_boolean(
            'Hide page indicators:',
            PrefsKeys.HIDE_PAGE_INDICATORS
        );

        return {
            page: page,
            name: name
        };
    },

    _get_size_page: function() {
        let name = 'Dialog size';
        let page = new PrefsGrid(Utils.SETTINGS);

        let range_properties = {
            min: 10,
            max: 100,
            step: 10,
            size: 300
        };
        page.add_range(
            'Width (% of screen):',
            PrefsKeys.DIALOG_WIDTH_PERCENTS,
            range_properties
        )
        page.add_range(
            'Height (% of screen):',
            PrefsKeys.DIALOG_HEIGHT_PERCENTS,
            range_properties
        )

        return {
            page: page,
            name: name
        };
    },

    _get_keywords_page: function() {
        let name = 'Keywords';
        let page = new PrefsGrid(Utils.SETTINGS);

        let keywords_widget = new KeywordsWidget(
            StackExchangeSites.LIST,
            PrefsKeys.KEYWORDS
        );
        page.add_item(keywords_widget)

        return {
            page: page,
            name: name
        };
    },

    _get_keybindings_page: function() {
        let name = 'Keybindings';
        let page = new PrefsGrid(Utils.SETTINGS);

        let keybindings = {};
        keybindings[PrefsKeys.SHOW_HOWDOI] = 'Show HowDoI';

        let keybindings_widget = new KeybindingsWidget(keybindings);
        page.add_item(keybindings_widget)

        return {
            page: page,
            name: name
        };
    },
});

function init(){
    // nothing
}

function buildPrefsWidget() {
    let widget = new HowDoIPrefsWidget();
    widget.show_all();

    return widget;
}
