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
const ALLOWED_TAGS = (
    '<b><big><i><s><sub><sup><small><tt><u>' +
    '<em><strong><li><a><h1><h2><h3><img>'
);
const BLOCK_REGEXP =
    /(<code>)([\s\S]+?)<\/code>|(<blockquote>)([\s\S]+?)<\/blockquote>/ig;
const LINKS_REGEXP =
    /(?:<a href="(.*?)".*?>(.*?)<\/a>)|(?:<img src="(.*?)".*?>)/gi;
const IMAGE_TITLE = '[IMAGE, hover to see]';

const LIST_ITEM_SYMBOL = '\u2022';

const Answer = new Lang.Class({
    Name: 'HowDoIAnswer',

    _init: function(data) {
        for each(let key in Object.keys(data)) {
            this[key] = data[key];
        }

        this._text_blocks = [];
    },

    _replace_markup_tags: function(markup) {
        markup = markup.replace(/<em>/g, '<b>');
        markup = markup.replace(/<\/em>/g, '</b>');
        markup = markup.replace(/<strong>/g, '<b>');
        markup = markup.replace(/<\/strong>/g, '</b>');
        markup = markup.replace(/<li>/g, ' %s '.format(LIST_ITEM_SYMBOL));
        markup = markup.replace(/<\/li>/g, '\n');
        markup = markup.replace(/<h1>/g, '<span size="xx-large">');
        markup = markup.replace(/<\/h1>/g, '</span>');
        markup = markup.replace(/<h2>/g, '<span size="x-large">');
        markup = markup.replace(/<\/h2>/g, '</span>');
        markup = markup.replace(/<h3>/g, '<span size="large">');
        markup = markup.replace(/<\/h3>/g, '</span>');

        return markup;
    },

    _parse_links: function(block) {
        let match;
        let new_content = block.content;

        while((match = LINKS_REGEXP.exec(block.content)) !== null) {
            let url, title;
            let link_markup = '[a href="%s"]%s[/a]';

            if(!Utils.is_blank(match[3])) {
                url = match[3].trim();
                link_markup = link_markup.format(url, IMAGE_TITLE);
            }
            else {
                url = match[1].trim();
                title = match[2];
                link_markup = link_markup.format(url, title);
            }

            new_content = new_content.replace(match[0], link_markup);
        }

        block.content = new_content;
    },

    count_blocks: function(type=null) {
        let result = 0;

        for each(let block in this.text_blocks) {
            if(type === null) {
                result++;
            }
            else if(block.type === type && type === BLOCK_TYPE.CODE) {
                let lines_count = block.content.split('\n').length;
                if(lines_count > 1) result++;
            }
            else if(block.type === type) {
                result++;
            }
        }

        return result;
    },

    get_text_blocks: function() {
        if(this._text_blocks.length > 0) return this._text_blocks;

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
            this._parse_links(result);
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

        for each(let block in text_blocks) {
            if(block.type === BLOCK_TYPE.CODE) continue;
            this._parse_links(block);
        }

        this._text_blocks = text_blocks;
        return this._text_blocks;
    },

    destroy: function() {
        // nothing
    },

    get markup() {
        return Utils.strip_tags(this.body, ALLOWED_TAGS);
    },

    get text_blocks() {
        return this.get_text_blocks();
    }
});
