import {tagObject} from './render-tags.js';
export function tagNewFurniture(parent,start,id){for(const object of parent.children.slice(start))tagObject(object,id);}
