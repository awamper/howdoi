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
const ExtensionUtils = imports.misc.extensionUtils;

const Me = ExtensionUtils.getCurrentExtension();
const Utils = Me.imports.utils;

const SimpleCache = new Lang.Class({
    Name: 'HowDoISimpleCache',

    _init: function(limit) {
        this._items = [];
        this._limit = limit;
    },

    add: function(query, items) {
        if(this.get(query)) return;
        if(this._items.length >= this.limit) this._items.shift();
        this._items.push({
            hash: Utils.fnv32a(query),
            data: JSON.stringify(items)
        });
    },

    get: function(query) {
        let result = false;

        for each(let item in this._items) {
            if(item.hash === Utils.fnv32a(query)) {
                result = JSON.parse(item.data);
                break;
            }
        }

        return result;
    },

    clear: function() {
        this._items = [];
    },

    destroy: function() {
        this.clear();
        this._limit = null;
    },

    set limit(limit) {
        this._limit = limit;
    },

    get limit() {
        return this._limit;
    }
});
