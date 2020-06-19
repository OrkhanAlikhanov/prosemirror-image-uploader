# prosemirror-image-uploader

The necessary image uploader for prosemirror based editors like (tiptap, remirror).

# Features 🎉

- ✅ Image drop handling
- ✅ Image paste handling
- ✅ `<img>` tag insertion handling
- ✅ Typescript definitions
- ✅ Collaboration/undo history friendly
- ✅ No widgets/decorations
<!-- - ✅ Fully tested -->
<!-- - ✅ Fully documented -->
<!-- - ✅ Many examples -->

# Installation 📦
```bash
npm i prosemirror-image-uploader
```

# Basic Usage 📌
In your code, register the image upload plugin with the required `upload` function.
```ts
import { imageUploader } from 'prosemirror-image-uploader'

EditorState.create({
  plugins: [
    imageUploader({
      async upload(fileOrUrl: File | string, view: EditorView) {

        let url: string /// await uploadFileOrUrlToServerAndObtainUrl()

        return url
      }
    })
  ]
})
```

Also adjust your image node to accept 2 attributes, a boolean `error`, and a string `uploadId`:
```ts
{
  image: {
    attrs: {
      src: {},
      alt: { default: null },
      title: { default: null },
      uploadId: { default: null }, /// added
      error: { default: null }   /// added
    },
    parseDOM: [{tag: 'img[src]', getAttrs(dom) {
      return {
        src: dom.getAttribute('src'),
        title: dom.getAttribute('title'),
        alt: dom.getAttribute('alt'),
        uploadId: dom.getAttribute('uploadId'), /// added
        error: dom.getAttribute('error') /// added
      }
    }}],
    toDOM(node) { 
      let { src, alt, title, uploadId, error } = node.attrs;  /// updated
      return ['img', { src, alt, title, uploadId, error }] /// updated
    }
  },
}
```

# Approach 📚
Google Docs like approach is pursued. More coming soon...

# Guide 🔭
Coming soon...

## Caveats
Coming soon...

# Examples
Coming soon...

# Credits
- [Orkhan Alikhanov](https://github.com/OrkhanAlikhanov)
- [All Contributors](https://github.com/OrkhanAlikhanov/prosemirror-image-uploader/contributors)

# Love our work?
Hit the star button. It helps ❤️

# License
The MIT License (MIT). Please see [License](https://github.com/OrkhanAlikhanov/prosemirror-image-uploader/blob/master/LICENSE.md) File for more information.
