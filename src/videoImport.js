export const MAX_VIDEO_BYTES = 50 * 1024 * 1024
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const videoTypes = new Set(['video/mp4', 'video/webm', 'video/quicktime'])
const extensions = { mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime' }

export function normalizeVideoFile(file) {
  const mimeType = file.type || extensions[file.name.split('.').pop().toLowerCase()]
  if (!videoTypes.has(mimeType)) throw new Error('请选择 MP4、WebM 或 MOV 视频文件。')
  if (!file.size) throw new Error('视频文件为空，请重新选择。')
  if (file.size > MAX_VIDEO_BYTES) throw new Error('视频不能超过 50 MB，请压缩后再导入。')
  return file.type ? file : new File([file], file.name, { type: mimeType, lastModified: file.lastModified })
}

export function validateMediaFileSize(file) {
  if (file.type.startsWith('image/') && file.size > MAX_IMAGE_BYTES) throw new Error('图片不能超过 10 MB。')
  if (file.type.startsWith('video/')) normalizeVideoFile(file)
}

export async function insertVideoAsset(editor, file, createShapesForAssets) {
  const asset = await editor.getAssetForExternalContent({ type: 'file', file })
  if (asset?.type !== 'video' || !asset.props?.src) throw new Error('视频读取失败，请重新选择。')
  editor.markHistoryStoppingPoint('import video')
  const ids = await createShapesForAssets(editor, [asset], editor.getViewportPageBounds().center)
  const shapes = ids.map((id) => editor.getShape(id))
  if (!shapes.length || shapes.some((shape) => shape?.type !== 'video' || shape.props.assetId !== asset.id)) {
    throw new Error('视频导入失败，请重新选择。')
  }
  editor.updateShapes(shapes.map((shape) => ({ id: shape.id, type: 'video', props: { autoplay: false } })))
  return ids
}

export function probeVideoFile(file, { document: ownerDocument = document, urlApi = URL, timeoutMs = 10000 } = {}) {
  return new Promise((resolve, reject) => {
    const video = ownerDocument.createElement('video')
    const src = urlApi.createObjectURL(file)
    const finish = (error) => {
      clearTimeout(timer)
      video.onloadeddata = null
      video.onerror = null
      video.pause()
      video.removeAttribute('src')
      video.load()
      urlApi.revokeObjectURL(src)
      if (error) reject(error)
      else resolve()
    }
    const timer = setTimeout(() => finish(new Error('视频读取超时，请换一个文件重试。')), timeoutMs)
    video.onloadeddata = () => finish(video.videoWidth > 0 && video.videoHeight > 0 && Number.isFinite(video.duration) && video.duration > 0 ? null : new Error('视频没有可播放的画面或有效时长。'))
    video.onerror = () => finish(new Error('此视频无法播放，请转换为常见的 MP4 格式后重试。'))
    video.preload = 'auto'
    video.muted = true
    video.src = src
    video.load()
  })
}
