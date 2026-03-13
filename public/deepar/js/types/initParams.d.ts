import { ToneMapping } from "./DeepAR";
/**
 * Parameters for the initialization of {@link DeepAR} object.
 */
export interface DeepARParams {
    /**
     * License key created on <a href="https://developer.deepar.ai/">DeepAR developer portal</a> for your web app.
     */
    licenseKey: string;
    /**
     * HTML element where AR preview will be presented.
     *
     * This is usually a <a href="https://developer.mozilla.org/en-US/docs/Web/HTML/Element/div">div</a> element which
     * is used solely for AR preview. AR preview will fully occupy the previewElement's space.
     * Therefore, position and size your previewElement according to your preferred AR preview dimensions.
     *
     * > NOTE: AR preview will adjust to the size of the previewElement if it changes.
     *
     * The canvas element will be appended as child to the previewElement. If you wish to work with the canvas element directly
     * and position and size it yourself then use {@link canvas} parameter instead.
     *
     * > ⚠️ You must specify {@link previewElement} or {@link canvas}.
     */
    previewElement?: HTMLElement;
    /**
     *  The URL of a DeepAR effect file. This effect will be applied when DeepAR is initialized.
     *  This parameter is optional. You can always later switch to a different effect with {@link DeepAR.switchEffect}.
     */
    effect?: string;
    /**
     * Path to the root directory of the DeepAR SDK. This path will be used to locate and download all the additional needed files like ML models and wasm files.
     * By default, this points to the JsDelivr CDN. For example "https://cdn.jsdelivr.net/npm/deepar@5.0.0/".<br>
     *
     * If you want to host the DeepAR SDK yourself set the path to it here. It is recommended to host DeepAR SDK on your own since then you can use compressions like gzip and brotli on the files.
     *
     * > ⚠️ <b>Be sure that the version of DeepAR js file and the root SDK path match!</b>
     *
     * DeepAR SDK can be hosted on any other server, but be sure not to change the directory and file structure of DeepAR SDK when hosing it.<br>
     *
     * To configure usage of non-default ML models, define them in the {@link additionalOptions}.
     */
    rootPath?: string;
    /**
     * Canvas element where DeepAR will render the AR preview.
     *
     * > ⚠️ You must specify {@link previewElement} or {@link canvas}.
     *
     * The preferred way is by using the {@link previewElement} parameter.
     * In that case, the DeepAR will take care of correctly sizing the canvas.
     *
     * @example
     * ```javascript
     * const canvas = document.createElement('canvas')
     * canvas.style.display = 'block'
     *
     * // We want to fill the whole screen.
     * const width = window.innerWidth
     * const height = window.innerHeight
     * const dpr = window.devicePixelRatio || 1
     * canvas.width = width * dpr
     * canvas.height = height * dpr
     * canvas.style.width = `${width}px`
     * canvas.style.height = `${height}px`
     * ```
     */
    canvas?: HTMLCanvasElement;
    /**
     * Additional DeepAR options.
     */
    additionalOptions?: {
        /**
         * Camera options. DeepAR will use the camera by default.
         */
        cameraConfig?: {
            /**
             * If true, DeepAR will not use camera preview by default and all the other options here are ignored in that case. You can use your own camera/video by calling {@link DeepAR.setVideoElement} or start the camera at any time by calling {@link DeepAR.startCamera}
             */
            disableDefaultCamera?: boolean;
            /**
             * Can be "user" or "environment". User will be a front facing camera on mobile devices, while environment will be the back facing camera. Default is "user".
             */
            facingMode?: string;
            /**
             * Rotate the input camera. valid values: 0, 90, 180, 270.
             */
            rotation?: number;
            /**
             * Called when the camera permission is asked.
             */
            cameraPermissionAsked?: () => void;
            /**
             * Called when the camera permission is granted.
             */
            cameraPermissionGranted?: () => void;
        };
        /**
         * Provide a hint or hints to DeepAR to optimize the SDK in some scenarios. <br><br>
         * Available hints:
         * <ul>
         *     <li><b>faceModelsPredownload</b> - Will download the face models as soon as possible.</li>
         *     <li><b>segmentationModelsPredownload</b> - Will download the segmentation models as soon as possible. Note - it will not try to initialize segmentation. Segmentation will be lazy loaded when needed.</li>
         *     <li><b>segmentationInit</b> - Will initialize segmentation as soon as possible. Without this hint segmentation is lazy loaded when some segmentation effect is loaded.</li>
         *     <li><b>faceInit</b> - Will initialize face tracking as soon as possible. Without this hint face tracking is lazy loaded when some face tracking effect is loaded.</li>
         *     <li><b>enableFaceTrackingCnn</b> - Use CNN face tracking instead of standard face tracking. Enables long distance face tracking and better face tracking accuracy, but performance will be slower.</li>
         * </ul>
         */
        hint?: string | string[];
        /**
         * Face tracking module path and options.
         */
        faceTrackingConfig?: {
            /**
             * Path to the face tracking model. Something like "path/to/deepar/models/face/models-68-extreme.bin".
             */
            modelPath: string;
        };
        rigidFaceTrackingConfig?: {
            /**
             * Path to the pose libPoseEstimation.wasm file, e.g. "/path/to/deepar/wasm/libPoseEstimation.wasm".
             */
            poseEstimationWasmPath?: string;
            /**
             * Path to the detector model, e.g. "/path/to/deepar/models/face-cnn/face-det.bin".
             */
            detectorPath?: string;
            /**
             * Path to the tracker model, e.g. "/path/to/deepar/models/face-cnn/face-track-19-v2.bin".
             */
            trackerPath?: string;
            /**
             * Path to the face model object file, e.g. "/path/to/deepar/models/face/face-rigid.obj".
             */
            objPath?: string;
            /**
             * Path to tfjs-backend-wasm.wasm file, e.g. "path/to/deepar/wasm/tfjs-backend-wasm.wasm"
             */
            tfjsBackendWasmPath?: string;
            /**
             * Path to tfjs-backend-wasm-simd.wasm file, e.g. "path/to/deepar/wasm/tfjs-backend-wasm-simd.wasm"
             */
            tfjsBackendWasmSimdPath?: string;
            /**
             * Path to tfjs-backend-wasm-threaded-simd.wasm file, e.g. "path/to/deepar/wasm/tfjs-backend-wasm-threaded-simd.wasm"
             */
            tfjsBackendWasmThreadedSimdPath?: string;
        };
        faceTrackingCnnConfig?: {
            /**
             * Path to the pose libPoseEstimation.wasm file, e.g. "/path/to/deepar/wasm/libPoseEstimation.wasm".
             */
            poseEstimationWasmPath?: string;
            /**
             * Path to the detector model, e.g. "/path/to/deepar/models/face-cnn/face-det.bin".
             */
            detectorPath?: string;
            /**
             * Path to the tracker model, e.g. "/path/to/deepar/models/face-cnn/face-track.bin".
             */
            trackerPath?: string;
            /**
             * Path to the face model object file, e.g. "/path/to/deepar/models/face-cnn/face.obj".
             */
            objPath?: string;
            /**
             * Path to pdm zip, e.g. "/path/to/deepar/models/face-cnn/face-pdm.zip".
             */
            pdmZipPath?: string;
            /**
             * Path to tfjs-backend-wasm.wasm file, e.g. "path/to/deepar/wasm/tfjs-backend-wasm.wasm"
             */
            tfjsBackendWasmPath?: string;
            /**
             * Path to tfjs-backend-wasm-simd.wasm file, e.g. "path/to/deepar/wasm/tfjs-backend-wasm-simd.wasm"
             */
            tfjsBackendWasmSimdPath?: string;
            /**
             * Path to tfjs-backend-wasm-threaded-simd.wasm file, e.g. "path/to/deepar/wasm/tfjs-backend-wasm-threaded-simd.wasm"
             */
            tfjsBackendWasmThreadedSimdPath?: string;
        };
        /**
         * Segmentation module path and options.
         */
        segmentationConfig?: {
            /**
             * Path to the base segmentation model. Something like "path/to/deepar/models/segmentation/segmentation-192x192.bin".
             * Thi is not used by default.
             */
            modelPath?: string;
            /**
             * MediaPipe segmentation config.
             */
            mediaPipeConfig?: {
                /**
                 * Base path to wasm fileset. Something like "path/to/deepar/mediaPipe/segmentation/wasm".
                 */
                wasmBasePath?: string;
                /**
                 * MediaPipe selfie segmenter model to be used. Something like "path/to/deepar/mediaPipe/segmentation/model/selfie_segmenter.tflite".
                 */
                modelPath?: string;
            };
        };
        /**
         * Foot tracking module paths and options.
         * @internal
         */
        footTrackingConfig?: {
            /**
             * Path to the pose libPoseEstimation.wasm file, e.g. "/path/to/deepar/wasm/libPoseEstimation.wasm".
             */
            poseEstimationWasmPath?: string;
            /**
             * Path to the detector model, e.g. "/path/to/deepar/models/foot/foot-detector.bin".
             */
            detectorPath?: string;
            /**
             * Path to the tracker model, e.g. "/path/to/deepar/models/foot/foot-tracker.bin".
             */
            trackerPath?: string;
            /**
             * Path to the foot model object file, e.g. "/path/to/deepar/models/foot/foot-model.obj".
             */
            objPath?: string;
            /**
             * Path to tfjs-backend-wasm.wasm file, e.g. "path/to/deepar/wasm/tfjs-backend-wasm.wasm"
             */
            tfjsBackendWasmPath?: string;
            /**
             * Path to tfjs-backend-wasm-simd.wasm file, e.g. "path/to/deepar/wasm/tfjs-backend-wasm-simd.wasm"
             */
            tfjsBackendWasmSimdPath?: string;
            /**
             * Path to tfjs-backend-wasm-threaded-simd.wasm file, e.g. "path/to/deepar/wasm/tfjs-backend-wasm-threaded-simd.wasm"
             */
            tfjsBackendWasmThreadedSimdPath?: string;
        };
        /**
         * Foot tracking module paths and options.
         * @internal
         */
        wristTrackingConfig?: {
            /**
             * Path to the pose libPoseEstimation.wasm file, e.g. "/path/to/deepar/wasm/libPoseEstimation.wasm".
             */
            poseEstimationWasmPath?: string;
            /**
             * Path to the detector model, e.g. "/path/to/deepar/models/wrist/wrist-det-9.bin".
             */
            detectorPath?: string;
            /**
             * Path to the tracker model, e.g. "/path/to/deepar/models/wrist/wrist-track-181-q.bin".
             */
            trackerPath?: string;
            /**
             * Path to the foot model object file, e.g. "/path/to/deepar/models/wrist/wrist-track.obj".
             */
            objPath?: string;
            /**
             * Path to tfjs-backend-wasm.wasm file, e.g. "path/to/deepar/wasm/tfjs-backend-wasm.wasm"
             */
            tfjsBackendWasmPath?: string;
            /**
             * Path to tfjs-backend-wasm-simd.wasm file, e.g. "path/to/deepar/wasm/tfjs-backend-wasm-simd.wasm"
             */
            tfjsBackendWasmSimdPath?: string;
            /**
             * Path to tfjs-backend-wasm-threaded-simd.wasm file, e.g. "path/to/deepar/wasm/tfjs-backend-wasm-threaded-simd.wasm"
             */
            tfjsBackendWasmThreadedSimdPath?: string;
        };
        /**
         * Path to deepar.wasm file. Something like "/path/to/deepar/wasm/deepar.wasm".
         */
        deeparWasmPath?: string;
        /**
         * Path to dyXzimgMagicFace.wasm file. Something like "/path/to/deepar/wasm/dyXzimgMagicFace.wasm".
         */
        dyXzimgMagicFaceWasmPath?: string;
        /**
         * Path to dyArcoreScripting.wasm file. Something like "/path/to/deepar/wasm/dyArcoreScripting.wasm".
         */
        dyArcoreScriptingWasmPath?: string;
        /**
         * Path to dyArcorePhysics.wasm file. Something like "/path/to/deepar/wasm/dyArcorePhysics.wasm".
         */
        dyArcorePhysicsWasmPath?: string;
        /**
         * Dynamic JS modules paths.
         */
        dynamicModulesConfig?: {
            /**
             * Path to xzimg.js file. Something like "/path/to/deepar/js/dynamicModules/xzimg.js".
             */
            xzimgPath?: string;
            /**
             * Path to mediaPipe.js file. Something like "/path/to/deepar/js/dynamicModules/mediaPipe.js".
             */
            mediaPipePath?: string;
        };
        /**
         * Embedded DeepAR effect files paths.
         */
        embeddedEffectsConfig?: {
            /**
             * Path to background_blur.deepar file. Something like "/path/to/deepar/effects/background_blur.deepar".
             */
            backgroundBlurPath?: string;
            /**
             * Path to background_replacement.deepar file. Something like "/path/to/deepar/effects/background_replacement.deepar".
             */
            backgroundReplacementPath?: string;
        };
        /**
         * Path to the default_envmap.webp file.
         */
        defaultEnvmapPath?: string;
        /**
         * Path to some custom environment map effect should be rendered with.
         * Internally, it is going to fetch the map and call setEnvironementMap.
         */
        customEnvMapPath?: string;
        /**
         * Tone mapping exposure.
         */
        exposure?: number;
        /**
         * Environment map intensity.
         */
        envMapIntensity?: number;
        /**
         * Tone mapping.
         */
        toneMapping?: ToneMapping;
        /**
         * Pixel ratio used for scaling the canvas.
         * By default, SDK uses min(window.devicePixelRatio, 2).
         */
        pixelRatio?: number;
        /**
         * @internal
         */
        onVerify?: (x: any) => any;
    };
}
