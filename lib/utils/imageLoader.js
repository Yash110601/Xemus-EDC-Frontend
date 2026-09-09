/**
 * Image Loader Utility
 * Common utility function to load images from blob storage URLs
 * using the viewStudyDocumentByUrl API endpoint
 */

import React from "react"
import { studyService } from "@/lib/services"

/**
 * Load an image from a blob storage URL and return the blob URL
 * This function uses the viewStudyDocumentByUrl API to fetch the image
 * and create a blob URL that can be used in <img> tags or other display elements
 * 
 * @param {string} imageUrl - The blob storage URL of the image
 * @returns {Promise<{blobUrl: string | null, error: string | null}>}
 *   Returns an object with blobUrl (if successful) or error message (if failed)
 * 
 * @example
 * const { blobUrl, error } = await loadImageAsBlobUrl('https://storage.../image.jpg')
 * if (blobUrl) {
 *   setImageSrc(blobUrl)
 * }
 */
export async function loadImageAsBlobUrl(imageUrl) {
  if (!imageUrl) {
    return { blobUrl: null, error: null }
  }

  try {
    // Use returnBlobUrl=true to get the blob URL without opening in new tab
    const response = await studyService.viewStudyDocumentByUrl(imageUrl, false, true)

    if (!response.isSuccess || !response.blobUrl) {
      return {
        blobUrl: null,
        error: response.message || "Failed to load image"
      }
    }

    // Check if blob is valid
    if (!response.data || response.data.size === 0) {
      return {
        blobUrl: null,
        error: "Invalid image data"
      }
    }

    return {
      blobUrl: response.blobUrl,
      error: null
    }
  } catch (error) {
    console.error("Error loading image:", error)
    return {
      blobUrl: null,
      error: error.message || "An unexpected error occurred while loading the image"
    }
  }
}

/**
 * React Hook to load and manage image blob URLs with automatic cleanup
 * This hook manages the blob URL lifecycle, revoking it when the component unmounts
 * or when a new image is loaded
 * 
 * @param {string} imageUrl - The blob storage URL of the image
 * @returns {[string | null, boolean, string | null]} - [blobUrl, loading, error]
 * 
 * @example
 * const [blobUrl, loading, error] = useImageBlobUrl(user.profilePhotoUrl)
 * 
 * {loading && <div>Loading...</div>}
 * {error && <div>Error: {error}</div>}
 * {blobUrl && <img src={blobUrl} alt="Profile" />}
 */
export function useImageBlobUrl(imageUrl) {
  const [blobUrl, setBlobUrl] = React.useState(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState(null)

  React.useEffect(() => {
    let isMounted = true
    let currentBlobUrl = null

    const loadImage = async () => {
      // Clean up previous blob URL
      if (currentBlobUrl) {
        window.URL.revokeObjectURL(currentBlobUrl)
        currentBlobUrl = null
      }

      if (!imageUrl) {
        if (isMounted) {
          setBlobUrl(null)
          setLoading(false)
          setError(null)
        }
        return
      }

      if (isMounted) {
        setLoading(true)
        setError(null)
      }

      const result = await loadImageAsBlobUrl(imageUrl)

      if (!isMounted) {
        // Clean up blob URL if component unmounted
        if (result.blobUrl) {
          window.URL.revokeObjectURL(result.blobUrl)
        }
        return
      }

      if (result.error) {
        setBlobUrl(null)
        setError(result.error)
      } else {
        currentBlobUrl = result.blobUrl
        setBlobUrl(result.blobUrl)
        setError(null)
      }
      setLoading(false)
    }

    loadImage()

    // Cleanup function
    return () => {
      isMounted = false
      if (currentBlobUrl) {
        window.URL.revokeObjectURL(currentBlobUrl)
      }
    }
  }, [imageUrl])

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (blobUrl) {
        window.URL.revokeObjectURL(blobUrl)
      }
    }
  }, [blobUrl])

  return [blobUrl, loading, error]
}

