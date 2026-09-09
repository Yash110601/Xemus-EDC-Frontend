"use client"

import { useState, useEffect, useRef } from "react"

/**
 * Custom hook for counting animation that only runs once per session
 * @param {number} targetValue - The target number to count to
 * @param {number} duration - Animation duration in milliseconds (default: 2000)
 * @param {string} storageKey - Key for sessionStorage to track if animation played
 * @returns {number} - The current animated count value
 */
export function useCountAnimation(targetValue, duration = 2000, storageKey = "countAnimationPlayed") {
  const [count, setCount] = useState(0)
  const [hasAnimated, setHasAnimated] = useState(false)
  const animationRef = useRef(null)

  useEffect(() => {
    // Only animate if we have a valid target value
    if (targetValue === 0 || targetValue === null || targetValue === undefined) {
      setCount(0)
      return
    }

    // Check if animation has been played in this session
    const played = typeof window !== "undefined" && sessionStorage.getItem(storageKey) === "true"
    
    if (played) {
      // If already played, set to target immediately
      setCount(targetValue)
      setHasAnimated(true)
      return
    }

    // Start animation
    const startTime = Date.now()
    const startValue = 0

    const animate = () => {
      const now = Date.now()
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      
      // Easing function (ease-out)
      const easeOut = 1 - Math.pow(1 - progress, 3)
      const currentValue = Math.floor(startValue + (targetValue - startValue) * easeOut)
      
      setCount(currentValue)

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate)
      } else {
        setCount(targetValue)
        setHasAnimated(true)
        // Mark as played in sessionStorage
        if (typeof window !== "undefined") {
          sessionStorage.setItem(storageKey, "true")
        }
      }
    }

    // Small delay to ensure smooth start
    const timeoutId = setTimeout(() => {
      animationRef.current = requestAnimationFrame(animate)
    }, 100)

    return () => {
      clearTimeout(timeoutId)
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [targetValue, duration, storageKey])

  return count
}

