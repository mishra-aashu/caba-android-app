/**
 * Information about the feet being tracked. FootData object is constructed and passed in the {@link DeepARCallbacks.onFeetTracked} callback.
 * @internal
 */
export interface FootData {
    /**
     * True if the foot is detected, false otherwise.
     */
    detected: boolean;
    /**
     * Array of 3 floats containing (x, y, z) scale of the foot in 3D space.
     */
    scale: number[];
    /**
     * Array of 4 floats containing quat rotation of the foot in 3D space.
     */
    rotation: number[];
    /**
     * Array of 3 floats containing (x, y, z) position of the foot in 3D space.
     */
    position: number[];
}
