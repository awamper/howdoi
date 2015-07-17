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
const Pango = imports.gi.Pango;
const ExtensionUtils = imports.misc.extensionUtils;

const Me = ExtensionUtils.getCurrentExtension();
const Utils = Me.imports.utils;

const BLOCK_TYPE = {
    TEXT: 0,
    CODE: 1,
    BLOCKQUOTE: 2
};
const ALLOWED_TAGS =
    '<b><big><i><s><sub><sup><small><tt><u><em><strong>';
const BLOCK_REGEXP =
    /(<code>)([\s\S]+?)<\/code>|(<blockquote>)([\s\S]+?)<\/blockquote>/ig;

const Answer = new Lang.Class({
    Name: 'HowDoIAnswer',

    _init: function(data) {
        for each(let key in Object.keys(data)) {
            this[key] = data[key];
        }
    },

    _replace_markup_tags: function(markup) {
        markup = markup.replace(/<em>/g, '<b>');
        markup = markup.replace(/<\/em>/g, '</b>');
        markup = markup.replace(/<strong>/g, '<b>');
        markup = markup.replace(/<\/strong>/g, '</b>');

        return markup;
    },

    get_text_blocks: function() {
        let block_maps = [];
        let match;

        while((match = BLOCK_REGEXP.exec(this.body)) !== null) {
            let tag = match[1] || match[3];
            let content = match[2] || match[4];
            let type = (
                tag === '<code>'
                ? BLOCK_TYPE.CODE
                : BLOCK_TYPE.BLOCKQUOTE
            );
            let map = {
                type: type,
                start: match.index + tag.length,
                stop: match.index + content.length + tag.length
            };

            block_maps.push(map);
        }

        if(block_maps.length < 1) {
            let content = Utils.strip_tags(this.body, ALLOWED_TAGS);
            content = this._replace_markup_tags(content);
            let result = {
                type: BLOCK_TYPE.TEXT,
                content: content
            };
            return [result];
        }

        let last_index = 0;
        let text_blocks = [];

        for each(let map in block_maps) {
            let text_block = Utils.strip_tags(
                this.body.slice(last_index, map.start),
                ALLOWED_TAGS
            );
            text_block = this._replace_markup_tags(text_block)
            if(!Utils.is_blank(text_block)) {
                text_blocks.push({
                    type: BLOCK_TYPE.TEXT,
                    content: text_block
                });
            }

            let block = {
                type: map.type,
                content: this.body.slice(map.start, map.stop)
            };
            if(map.type === BLOCK_TYPE.BLOCKQUOTE) {
                let content = Utils.strip_tags(
                    block.content,
                    ALLOWED_TAGS
                );
                content = this._replace_markup_tags(content);
                block.content = content;
            }

            text_blocks.push(block);

            if(block_maps.indexOf(map) === block_maps.length - 1) {
                let last_block = Utils.strip_tags(
                    this.body.slice(map.stop),
                    ALLOWED_TAGS
                );
                last_block = this._replace_markup_tags(last_block);

                if(!Utils.is_blank(last_block)) {
                    text_blocks.push({
                        type: BLOCK_TYPE.TEXT,
                        content: last_block
                    });
                }
            }
            else {
                last_index = map.stop;
            }
        }

        return text_blocks;
    },

    destroy: function() {
        // nothing
    },

    get markup() {
        return Utils.strip_tags(this.body, ALLOWED_TAGS);
    }
});
