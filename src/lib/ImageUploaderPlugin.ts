// Copyright (C) 2020, Orkhan Alikhanov <http://orkhanalikhanov.com>. All rights reserved.

import { Fragment, Node, Slice } from 'prosemirror-model';
import 'prosemirror-replaceattrs'; /// register it
import { Plugin } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';

type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;

interface ImageUploaderPluginOptions {
  updateImageNodes?: (
    view: EditorView,
    imageNodes: Array<{ node: Node; pos: number }>,
    url: string | undefined
  ) => boolean;

  placeholderSrc: string;

  types: string[];

  upload(fileOrUrl: File | string, view: EditorView): Promise<string>;

  id(): string;
}

export const defaultConfig: Pick<
  ImageUploaderPluginOptions,
  'placeholderSrc' | 'types' | 'id'
> = {
  id: () =>
    Math.random()
      .toString(36)
      .substring(7),
  placeholderSrc:
    "data:image/svg+xml,%3Csvg width='20' height='20' xmlns='http://www.w3.org/2000/svg'/%3E\n", /// empty svg with size
  types: ['image/jpeg', 'image/gif', 'image/png', 'image/jpg']
};

export function imageUploader(
  options: Optional<ImageUploaderPluginOptions, keyof typeof defaultConfig>
) {
  const plugin = new ImageUploaderPlugin({ ...defaultConfig, ...options });

  const dummy = {};
  return new Plugin({
    props: {
      handleDOMEvents: {
        keydown(view) {
          return !plugin.setView(view);
        },

        drop(view) {
          return !plugin.setView(view);
        },

        focus(view) {
          return !plugin.setView(view);
        }
      },

      handlePaste(view, event) {
        return plugin.setView(view).handlePaste(event) || false;
      },

      transformPasted(slice) {
        /// Workaround for missing view is provided above.
        return plugin.transformPasted(slice);
      },

      handleDrop(view, event) {
        return plugin.setView(view).handleDrop(event as DragEvent) || false;
      }
    },

    state: {
      init() {
        return dummy;
      },

      apply(tr, _value, _oldState, newState) {
        const filesOrUrls = tr.getMeta('uploadImages');

        if (filesOrUrls) {
          const arr: Array<File | string> =
            typeof filesOrUrls === 'string' || filesOrUrls instanceof File
              ? [filesOrUrls]
              : Array.from(filesOrUrls); /// Probably a FileList or an array of files/urls

          // give some time for editor, otherwise history plugin forgets history
          setTimeout(
            () =>
              arr.forEach((item, i) =>
                plugin.uploadImage(item, newState.selection.from + i)
              ),
            10
          );
        }

        return dummy;
      }
    }
  });
}

export class ImageUploaderPlugin {
  public view!: EditorView;

  constructor(public config: ImageUploaderPluginOptions) {}

  public handlePaste(event: ClipboardEvent) {
    const items = Array.from(event.clipboardData?.items || []);

    /// Clipboard may contain both html and image items (like when pasting from ms word, excel)
    /// in that case (if there is any html), don't handle images.
    if (items.some(x => x.type === 'text/html')) {
      return false;
    }

    const image = items.find(item => this.config.types.includes(item.type));

    if (image) {
      this.uploadImage(image.getAsFile()!, this.view.state.selection.from);
      return true;
    }

    return false;
  }

  public transformPasted(slice: Slice) {
    const imageNodes: Array<{ url: string; id: string }> = [];

    const children: Node[] = [];
    slice.content.forEach(child => {
      let newChild = child;

      /// if the node itself is image
      if (child.type.name === 'image') {
        newChild = this.newUploadingImageNode(child.attrs);
        imageNodes.push({
          id: newChild.attrs.uploadId,
          url: child.attrs.src
        });
      } else {
        child.descendants((node, pos) => {
          if (node.type.name === 'image') {
            const imageNode = this.newUploadingImageNode(node.attrs);
            newChild = newChild.replace(
              pos,
              pos + 1,
              new Slice(Fragment.from(imageNode), 0, 0)
            );
            imageNodes.push({
              id: imageNode.attrs.uploadId,
              url: node.attrs.src
            });
          }
        });
      }

      children.push(newChild);
    });

    imageNodes.forEach(({ url, id }) => this.uploadImageForId(url, id));

    return new Slice(
      Fragment.fromArray(children),
      slice.openStart,
      slice.openEnd
    );
  }

  public handleDrop(event: DragEvent) {
    if (!event.dataTransfer?.files.length) {
      return;
    }

    const coordinates = this.view.posAtCoords({
      left: event.clientX,
      top: event.clientY
    });
    if (!coordinates) {
      return;
    }

    this.uploadImageFiles(event.dataTransfer.files, coordinates.pos);

    return true;
  }

  public newUploadingImageNode(attrs?: any): Node {
    return this.view.state.schema.nodes.image.create({
      ...attrs,
      src: this.config.placeholderSrc,
      uploadId: this.config.id()
    });
  }

  public async uploadImageForId(fileOrUrl: File | string, id: string) {
    const getImagePositions = () => {
      const positions: Array<{ node: Node; pos: number }> = [];
      this.view.state.doc.descendants((node, pos) => {
        if (node.type.name === 'image' && node.attrs.uploadId === id) {
          positions.push({ node, pos });
        }
      });

      return positions;
    };

    const url = (await this.config
      .upload(fileOrUrl, this.view)
      // tslint:disable-next-line:no-console
      .catch(console.warn)) as string | undefined;

    const imageNodes = getImagePositions();
    if (!imageNodes.length) {
      return;
    }

    if (this.config.updateImageNodes?.(this.view, imageNodes, url)) {
      return;
    }

    let tr = this.view.state.tr
      /// disallow user from undoing back to 'uploading' state.
      .setMeta('addToHistory', false);

    imageNodes.forEach(({ node, pos }) => {
      tr = tr.replaceAttrs(pos, {
        ...node.attrs,
        uploadId: null,
        src: url || null,
        error: !url || null
      });
    });

    this.view.dispatch(tr);
  }

  public uploadImageFiles(files: ArrayLike<File>, at: number) {
    const imageFiles = Array.from(files).filter(file =>
      this.config.types.includes(file.type)
    );

    if (!imageFiles.length) {
      return;
    }

    imageFiles.forEach((image, i) => {
      this.uploadImage(image, at + i);
    });
  }

  public uploadImage(fileOrUrl: File | string, at: number) {
    const tr = this.view.state.tr;
    if (!tr.selection.empty) {
      tr.deleteSelection();
    }

    /// insert image node.
    const node = this.newUploadingImageNode();
    this.view.dispatch(tr.replaceWith(at, at, node));

    /// upload image for above node
    this.uploadImageForId(fileOrUrl, node.attrs.uploadId);
  }

  public setView(view: EditorView): this {
    this.view = view;
    return this;
  }
}
