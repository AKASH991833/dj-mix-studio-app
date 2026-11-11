(() => {
  // ../../home/sandbox/djmix/node_modules/@soundtouchjs/audio-worklet/.dist/constants.js
  var PROCESSOR_NAME = "soundtouch-processor";
  var DEFAULT_SAMPLE_BUFFER_TYPE = "circular";

  // ../../home/sandbox/djmix/node_modules/@soundtouchjs/audio-worklet/.dist/SoundTouchNode.js
  var SoundTouchNode = class extends AudioWorkletNode {
    /**
     * The registered processor name for this node type.
     */
    static processorName = PROCESSOR_NAME;
    /**
     * Registers the SoundTouch processor module with the given AudioContext.
     *
     * @remarks
     * Must be called before creating SoundTouchNode instances. Loads the processor script into the AudioWorklet.
     *
     * @param context - The AudioContext or OfflineAudioContext
     * @param processorUrl - URL or path to the processor script
     */
    static async register(context, processorUrl) {
      await context.audioWorklet.addModule(processorUrl);
    }
    /**
     * Registers an interpolation strategy installer module in AudioWorkletGlobalScope.
     *
     * @remarks
     * The module should call core registration APIs during evaluation.
     * Loads a strategy plugin for use in the render-thread processor.
     */
    static async registerStrategyModule(context, strategyModuleUrl) {
      await context.audioWorklet.addModule(strategyModuleUrl);
    }
    _lastMetrics = null;
    /**
     * Creates a SoundTouchNode instance.
     * @param options - Node and processor configuration.
     */
    constructor({ context, sampleBufferType, interpolationStrategy, outputChannelCount }) {
      super(context, PROCESSOR_NAME, {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [outputChannelCount ?? 2],
        processorOptions: {
          sampleBufferType: sampleBufferType ?? DEFAULT_SAMPLE_BUFFER_TYPE,
          interpolationStrategy
        }
      });
      this.port.onmessage = (event) => {
        const message = event.data;
        if (message?.type === "metrics") {
          const metrics = {
            framesBuffered: message.framesBuffered,
            underrunCount: message.underrunCount,
            blockCount: message.blockCount,
            outputRms: message.outputRms,
            outputPeak: message.outputPeak,
            timestamp: performance.now()
          };
          this._lastMetrics = metrics;
          this.dispatchEvent(new CustomEvent("metrics", { detail: metrics }));
        }
      };
    }
    /**
     * Returns the most recent processor metrics snapshot, or `null` if no metrics have been received yet.
     *
     * @remarks
     * Updated every 100 render blocks by the processor. Also dispatched as a `metrics` CustomEvent.
     *
     * @example
     * stNode.addEventListener('metrics', (e) => {
     *   console.log((e as CustomEvent<ProcessorMetrics>).detail.underrunCount);
     * });
     */
    get metrics() {
      return this._lastMetrics;
    }
    /**
     * Pitch multiplier AudioParam (1.0 = original pitch).
     * @returns The AudioParam controlling pitch.
     */
    get pitch() {
      return this.parameters.get("pitch");
    }
    /**
     * Pitch shift in semitones AudioParam (integer steps for musical key changes).
     * @returns The AudioParam controlling pitch in semitones.
     */
    get pitchSemitones() {
      return this.parameters.get("pitchSemitones");
    }
    /**
     * Playback rate AudioParam. Set this to the same value as the source node's
     * playbackRate so the processor can compensate pitch for tempo changes.
     * @returns The AudioParam controlling playback rate.
     */
    get playbackRate() {
      return this.parameters.get("playbackRate");
    }
    /**
     * Switches interpolation strategy at runtime in the render-thread processor.
     * @param strategy The new interpolation strategy to use.
     */
    setInterpolationStrategy(strategy) {
      this.port.postMessage({
        type: "set-interpolation-strategy",
        strategy
      });
    }
    /**
     * Applies a partial params update to the active interpolation strategy.
     * @param params Partial set of parameters to update.
     */
    setInterpolationStrategyParams(params) {
      this.port.postMessage({
        type: "set-interpolation-strategy-params",
        params
      });
    }
    /**
     * Applies a partial set of WSOLA timing parameters to the render-thread processor.
     *
     * @remarks
     * The update is queued and applied at the next render-block boundary. Only the
     * provided fields are updated; omitted fields remain unchanged. Pass `sequenceMs: 0`
     * or `seekWindowMs: 0` to switch that dimension back to auto-calculation.
     *
     * @param params Partial WSOLA timing parameters to apply.
     *
     * @example
     * stNode.setStretchParameters({ overlapMs: 12, quickSeek: false });
     */
    setStretchParameters(params) {
      this.port.postMessage({
        type: "set-stretch-parameters",
        params
      });
    }
  };

  // src/processor.txt
  var processor_default = '//#region ../core/src/AbstractSamplePipe.ts\n/**\n* Abstract base class for sample processing pipes.\n*\n* @remarks\n* Manages input and output buffers for audio sample processing chains. Subclasses should implement\n* specific processing logic for audio transformation or analysis. This class is not intended to be used\n* directly, but as a base for concrete audio processing stages.\n*\n* @typeParam TInputBuffer - Concrete input buffer type (defaults to the generic `SampleBuffer` contract).\n* @typeParam TOutputBuffer - Concrete output buffer type (defaults to `TInputBuffer` so input/output share the same buffer type unless a subclass opts into different types).\n*/\nvar AbstractSamplePipe = class {\n	/**\n	* Input buffer for audio samples.\n	*/\n	_inputBuffer;\n	/**\n	* Output buffer for processed audio samples.\n	*/\n	_outputBuffer;\n	/**\n	* Constructs an AbstractSamplePipe.\n	* @param options Constructor options.\n	*\n	* @remarks\n	* When `createBuffers` is true, both factories are required so subclasses can\n	* control exact buffer implementations without unsafe casting.\n	*/\n	constructor({ createBuffers = false, inputBufferFactory, outputBufferFactory } = {}) {\n		if (createBuffers) {\n			if (!inputBufferFactory || !outputBufferFactory) throw new Error("buffer factories are required when createBuffers is true");\n			this._inputBuffer = inputBufferFactory();\n			this._outputBuffer = outputBufferFactory();\n		} else {\n			this._inputBuffer = null;\n			this._outputBuffer = null;\n		}\n	}\n	/**\n	* Gets the input buffer.\n	* @returns The current input buffer instance, or null if not set.\n	*/\n	get inputBuffer() {\n		return this._inputBuffer;\n	}\n	/**\n	* Sets the input buffer.\n	* @param inputBuffer The new input buffer instance, or null to unset.\n	*/\n	set inputBuffer(inputBuffer) {\n		this._inputBuffer = inputBuffer;\n	}\n	/**\n	* Gets the output buffer.\n	* @returns The current output buffer instance, or null if not set.\n	*/\n	get outputBuffer() {\n		return this._outputBuffer;\n	}\n	/**\n	* Sets the output buffer.\n	* @param outputBuffer The new output buffer instance, or null to unset.\n	*/\n	set outputBuffer(outputBuffer) {\n		this._outputBuffer = outputBuffer;\n	}\n	/**\n	* Clears both input and output buffers.\n	*\n	* @remarks\n	* Resets the state of both input and output buffers, if present, by calling their `clear()` methods.\n	*/\n	clear() {\n		this._inputBuffer?.clear();\n		this._outputBuffer?.clear();\n	}\n};\n//#endregion\n//#region ../core/src/CircularSampleBuffer.ts\nvar SAMPLES_PER_FRAME$1 = 2;\n/**\n* Circular frame buffer for interleaved stereo audio samples.\n*\n* @remarks\n* Implements a ring buffer for stereo audio, where each frame consists of two contiguous float values (left, right).\n* Maintains a movable read cursor and appends at the logical end. Capacity grows automatically as needed while preserving frame order.\n* Used for efficient, low-latency audio processing where buffer wraparound and dynamic resizing are required.\n*/\nvar CircularSampleBuffer = class {\n	_buffer;\n	_capacityFrames;\n	_readFrame;\n	_frameCount;\n	/**\n	* @param capacityFrames Initial frame capacity before automatic growth.\n	*/\n	constructor(capacityFrames = 2048) {\n		const normalizedCapacity = Math.max(1, Math.floor(capacityFrames));\n		this._capacityFrames = normalizedCapacity;\n		this._buffer = new Float32Array(normalizedCapacity * SAMPLES_PER_FRAME$1);\n		this._readFrame = 0;\n		this._frameCount = 0;\n	}\n	/**\n	* Allocated capacity expressed in frames.\n	* @returns The number of frames the buffer can currently hold without resizing.\n	*/\n	get capacityFrames() {\n		return this._capacityFrames;\n	}\n	/**\n	* Number of buffered frames currently readable.\n	* @returns The number of frames available for reading.\n	*/\n	get frameCount() {\n		return this._frameCount;\n	}\n	/**\n	* Clears the buffer without shrinking allocated capacity.\n	*\n	* @remarks\n	* Resets the read cursor and frame count, but does not deallocate the underlying storage.\n	*/\n	clear() {\n		this._readFrame = 0;\n		this._frameCount = 0;\n	}\n	/**\n	* Ensures the internal storage can hold at least `minCapacityFrames`.\n	*\n	* @param minCapacityFrames Minimum frame capacity required.\n	* @remarks\n	* Grows the buffer if needed, preserving all readable frames in order.\n	*/\n	ensureCapacity(minCapacityFrames) {\n		const normalizedMinCapacityFrames = Math.max(0, Math.floor(minCapacityFrames));\n		if (normalizedMinCapacityFrames <= this._capacityFrames) return;\n		const nextCapacity = Math.max(normalizedMinCapacityFrames, this._capacityFrames * 2, this._capacityFrames + 1024);\n		const nextBuffer = new Float32Array(nextCapacity * SAMPLES_PER_FRAME$1);\n		for (let frame = 0; frame < this._frameCount; frame += 1) {\n			const sourceIndex = (this._readFrame + frame) % this._capacityFrames * SAMPLES_PER_FRAME$1;\n			const destIndex = frame * SAMPLES_PER_FRAME$1;\n			nextBuffer[destIndex] = this._buffer[sourceIndex];\n			nextBuffer[destIndex + 1] = this._buffer[sourceIndex + 1];\n		}\n		this._buffer = nextBuffer;\n		this._capacityFrames = nextCapacity;\n		this._readFrame = 0;\n	}\n	/**\n	* Appends source frames to the end of the ring.\n	*\n	* @param source Interleaved stereo source samples.\n	* @param sourceFrameOffset Source offset in frames.\n	* @param frameCount Number of frames to append; defaults to all complete remaining frames.\n	* @remarks\n	* Automatically grows the buffer if needed. Only complete frames are appended.\n	*/\n	pushSamples(source, sourceFrameOffset = 0, frameCount = 0) {\n		const sourceStartSample = Math.max(0, Math.floor(sourceFrameOffset)) * SAMPLES_PER_FRAME$1;\n		const availableFrames = Math.max(0, Math.floor((source.length - sourceStartSample) / SAMPLES_PER_FRAME$1));\n		const requestedFrames = frameCount > 0 ? Math.floor(frameCount) : 0;\n		const framesToWrite = requestedFrames > 0 ? Math.min(requestedFrames, availableFrames) : availableFrames;\n		if (framesToWrite <= 0) return;\n		this.ensureCapacity(this._frameCount + framesToWrite);\n		const writeFrame = (this._readFrame + this._frameCount) % this._capacityFrames;\n		for (let frame = 0; frame < framesToWrite; frame += 1) {\n			const sourceIndex = sourceStartSample + frame * SAMPLES_PER_FRAME$1;\n			const destIndex = (writeFrame + frame) % this._capacityFrames * SAMPLES_PER_FRAME$1;\n			this._buffer[destIndex] = source[sourceIndex];\n			this._buffer[destIndex + 1] = source[sourceIndex + 1];\n		}\n		this._frameCount += framesToWrite;\n	}\n	/**\n	* Contract alias for `pushSamples`.\n	*\n	* @param source Interleaved stereo source samples.\n	* @param sourceFrameOffset Source offset in frames.\n	* @param frameCount Number of frames to append.\n	*/\n	putSamples(source, sourceFrameOffset = 0, frameCount = 0) {\n		this.pushSamples(source, sourceFrameOffset, frameCount);\n	}\n	/**\n	* Extracts frames from the ring into `target`.\n	*\n	* @param target Destination array for interleaved stereo samples.\n	* @param sourceFrameOffset Read offset in frames.\n	* @param frameCount Number of frames requested.\n	* @param consume When true, consumed frames are dropped from the front.\n	* @returns Number of frames copied.\n	* @remarks\n	* If `consume` is true, the extracted frames are removed from the buffer.\n	*/\n	extract(target, sourceFrameOffset = 0, frameCount = 0, consume = false) {\n		const normalizedSourceFrameOffset = Math.max(0, Math.floor(sourceFrameOffset));\n		const requestedFrames = frameCount > 0 ? Math.floor(frameCount) : 0;\n		const framesAvailable = Math.max(0, this._frameCount - normalizedSourceFrameOffset);\n		const framesToRead = requestedFrames > 0 ? Math.min(requestedFrames, framesAvailable) : framesAvailable;\n		if (framesToRead <= 0) return 0;\n		for (let frame = 0; frame < framesToRead; frame += 1) {\n			const sourceIndex = (this._readFrame + normalizedSourceFrameOffset + frame) % this._capacityFrames * SAMPLES_PER_FRAME$1;\n			const targetIndex = frame * SAMPLES_PER_FRAME$1;\n			target[targetIndex] = this._buffer[sourceIndex];\n			target[targetIndex + 1] = this._buffer[sourceIndex + 1];\n		}\n		if (consume) {\n			const framesToDrop = normalizedSourceFrameOffset + framesToRead;\n			this.dropFrames(framesToDrop);\n		}\n		return framesToRead;\n	}\n	/**\n	* Reads a single sample value by logical sample index.\n	*\n	* @param sampleIndex Logical sample index relative to the readable head.\n	* @returns Sample value, or `0` when the index falls outside readable data.\n	* @remarks\n	* Used for random access to individual samples within the readable region.\n	*/\n	readSample(sampleIndex) {\n		const normalizedSampleIndex = Math.max(0, Math.floor(sampleIndex));\n		const frameOffset = Math.floor(normalizedSampleIndex / SAMPLES_PER_FRAME$1);\n		if (frameOffset >= this._frameCount) return 0;\n		const channelOffset = normalizedSampleIndex % SAMPLES_PER_FRAME$1;\n		const sourceIndex = (this._readFrame + frameOffset) % this._capacityFrames * SAMPLES_PER_FRAME$1 + channelOffset;\n		return this._buffer[sourceIndex] ?? 0;\n	}\n	/**\n	* Drops frames from the front of the ring.\n	*\n	* @param frameCount Maximum number of frames to remove.\n	* @returns Number of frames removed.\n	* @remarks\n	* Advances the read cursor and reduces the frame count. If all frames are dropped, resets the read cursor.\n	*/\n	dropFrames(frameCount) {\n		const framesToDrop = Math.max(0, Math.min(Math.max(0, Math.floor(frameCount)), this._frameCount));\n		if (framesToDrop === 0) return 0;\n		this._readFrame = (this._readFrame + framesToDrop) % this._capacityFrames;\n		this._frameCount -= framesToDrop;\n		if (this._frameCount === 0) this._readFrame = 0;\n		return framesToDrop;\n	}\n	/**\n	* Contract alias for `dropFrames`.\n	*\n	* @param frameCount Number of frames to consume.\n	*/\n	receive(frameCount = this._frameCount) {\n		this.dropFrames(frameCount);\n	}\n};\n//#endregion\n//#region ../core/src/FifoSampleBuffer.ts\n/**\n* Number of bytes per sample (Float32).\n*/\nvar BYTES_PER_SAMPLE = 4;\n/**\n* Number of samples per audio frame (stereo).\n*/\nvar SAMPLES_PER_FRAME = 2;\n/**\n* Number of bytes per audio frame.\n*/\nvar BYTES_PER_FRAME = BYTES_PER_SAMPLE * SAMPLES_PER_FRAME;\n/**\n* Default maximum number of frames for buffer allocation.\n*/\nvar DEFAULT_MAX_FRAMES = 131072;\n/**\n* Resizable interleaved sample buffer for audio processing.\n*\n* @remarks\n* Stores stereo audio samples in a contiguous Float32Array and provides methods for efficient buffer management and sample transfer.\n* Uses ES2024 ArrayBuffer for zero-allocation growth. Suitable for scenarios where buffer size may need to grow dynamically during audio processing.\n*/\nvar FifoSampleBuffer = class {\n	/**\n	* Backing ArrayBuffer for sample storage.\n	* @remarks\n	* Underlying memory for the buffer, which may be resized as needed.\n	*/\n	_buffer;\n	/**\n	* Float32Array view of the buffer.\n	* @remarks\n	* Provides direct access to the sample data for reading and writing.\n	*/\n	_vector;\n	/**\n	* Current read position (frame index).\n	* @remarks\n	* Indicates the logical start of readable data within the buffer.\n	*/\n	_position;\n	/**\n	* Number of frames currently stored.\n	* @remarks\n	* Represents the number of complete stereo frames available for reading.\n	*/\n	_frameCount;\n	/**\n	* Creates a new FifoSampleBuffer.\n	* @param maxFrames Maximum number of frames for buffer allocation.\n	*/\n	constructor(maxFrames = DEFAULT_MAX_FRAMES) {\n		this._buffer = new ArrayBuffer(0, { maxByteLength: maxFrames * BYTES_PER_FRAME });\n		this._vector = new Float32Array(this._buffer);\n		this._position = 0;\n		this._frameCount = 0;\n	}\n	/**\n	* Returns the Float32Array view of the buffer.\n	* @returns The Float32Array containing the sample data.\n	*/\n	get vector() {\n		return this._vector;\n	}\n	/**\n	* Returns the current read position (frame index).\n	* @returns The current frame index for reading.\n	*/\n	get position() {\n		return this._position;\n	}\n	/**\n	* Returns the start sample index for reading.\n	* @returns The sample index corresponding to the start of readable data.\n	*/\n	get startIndex() {\n		return this._position * 2;\n	}\n	/**\n	* Returns the number of frames currently stored.\n	* @returns The number of complete frames available for reading.\n	*/\n	get frameCount() {\n		return this._frameCount;\n	}\n	/**\n	* Returns the end sample index for reading.\n	* @returns The sample index corresponding to the end of readable data.\n	*/\n	get endIndex() {\n		return (this._position + this._frameCount) * 2;\n	}\n	/**\n	* Clears the buffer and resets position and frame count.\n	* @remarks\n	* Fills the buffer with zeros and resets all internal state.\n	*/\n	clear() {\n		this._vector.fill(0);\n		this._position = 0;\n		this._frameCount = 0;\n	}\n	/**\n	* Adds empty frames to the buffer.\n	* @param numFrames Number of frames to add.\n	*/\n	put(numFrames) {\n		this._frameCount += numFrames;\n	}\n	/**\n	* Adds samples to the buffer from a Float32Array.\n	* @param samples Source samples (interleaved stereo).\n	* @param position Start frame index in source.\n	* @param numFrames Number of frames to copy (default: all available).\n	* @remarks\n	* Automatically grows the buffer if needed. Only complete frames are appended.\n	*/\n	putSamples(samples, position = 0, numFrames = 0) {\n		const sourceOffset = position * 2;\n		if (!(numFrames >= 0) || numFrames === 0) numFrames = (samples.length - sourceOffset) / 2;\n		const numSamples = numFrames * 2;\n		this.ensureCapacity(numFrames + this._frameCount);\n		const destOffset = this.endIndex;\n		this._vector.set(samples.subarray(sourceOffset, sourceOffset + numSamples), destOffset);\n		this._frameCount += numFrames;\n	}\n	/**\n	* Adds samples from another FifoSampleBuffer.\n	* @param buffer Source buffer.\n	* @param position Start frame index in source buffer.\n	* @param numFrames Number of frames to copy (default: all available).\n	*/\n	putBuffer(buffer, position = 0, numFrames = 0) {\n		if (!(numFrames >= 0) || numFrames === 0) numFrames = buffer.frameCount - position;\n		this.putSamples(buffer.vector, buffer.position + position, numFrames);\n	}\n	/**\n	* Advances the read position and reduces frame count.\n	* @param numFrames Number of frames to receive (default: all available).\n	* @remarks\n	* Consumed frames are no longer available for reading.\n	*/\n	receive(numFrames) {\n		if (numFrames === void 0 || !(numFrames >= 0) || numFrames > this._frameCount) numFrames = this._frameCount;\n		this._frameCount -= numFrames;\n		this._position += numFrames;\n	}\n	/**\n	* Copies and receives samples into an output array.\n	* @param output Destination Float32Array.\n	* @param numFrames Number of frames to copy and receive.\n	* @remarks\n	* Advances the read position after copying.\n	*/\n	receiveSamples(output, numFrames = 0) {\n		const numSamples = numFrames * 2;\n		const sourceOffset = this.startIndex;\n		output.set(this._vector.subarray(sourceOffset, sourceOffset + numSamples));\n		this.receive(numFrames);\n	}\n	/**\n	* Extracts samples into an output array without advancing position.\n	* @param output Destination Float32Array.\n	* @param position Start frame index in buffer.\n	* @param numFrames Number of frames to extract.\n	*/\n	extract(output, position = 0, numFrames = 0) {\n		const sourceOffset = this.startIndex + position * 2;\n		const numSamples = numFrames * 2;\n		output.set(this._vector.subarray(sourceOffset, sourceOffset + numSamples));\n	}\n	/**\n	* Ensures the buffer has capacity for at least numFrames.\n	* @param numFrames Minimum number of frames required.\n	* @remarks\n	* Grows the buffer if needed, preserving all readable frames in order.\n	*/\n	ensureCapacity(numFrames = 0) {\n		const minLength = Math.floor(numFrames * SAMPLES_PER_FRAME);\n		if (this._vector.length < minLength) {\n			const newByteLength = minLength * BYTES_PER_SAMPLE;\n			if (newByteLength <= this._buffer.maxByteLength) {\n				this.rewind();\n				this._buffer.resize(newByteLength);\n				this._vector = new Float32Array(this._buffer);\n			} else {\n				const newMaxBytes = newByteLength * 2;\n				const newBuffer = new ArrayBuffer(newByteLength, { maxByteLength: newMaxBytes });\n				const newVector = new Float32Array(newBuffer);\n				newVector.set(this._vector.subarray(this.startIndex, this.endIndex));\n				this._buffer = newBuffer;\n				this._vector = newVector;\n				this._position = 0;\n			}\n		} else this.rewind();\n	}\n	/**\n	* Ensures buffer has capacity for additional frames.\n	* @param numFrames Number of additional frames required.\n	*/\n	ensureAdditionalCapacity(numFrames = 0) {\n		this.ensureCapacity(this._frameCount + numFrames);\n	}\n	/**\n	* Moves all unread samples to the start of the buffer.\n	* @remarks\n	* Compacts the buffer so that all unread samples are at the beginning, freeing space for new data.\n	*/\n	rewind() {\n		if (this._position > 0) {\n			this._vector.set(this._vector.subarray(this.startIndex, this.endIndex));\n			this._position = 0;\n		}\n	}\n};\n//#endregion\n//#region ../core/src/SampleBufferAdapter.ts\nvar FifoSampleBufferAdapter = class {\n	inputBuffer;\n	constructor() {\n		this.inputBuffer = null;\n	}\n	get frameCount() {\n		return this.inputBuffer?.frameCount ?? 0;\n	}\n	clear() {\n		this.inputBuffer = null;\n	}\n	syncFromInputBuffer(inputBuffer) {\n		this.inputBuffer = inputBuffer;\n	}\n	extract(target, sourceFrameOffset, frameCount) {\n		const buffer = this.inputBuffer;\n		if (buffer === null) return 0;\n		const availableFrames = Math.max(0, buffer.frameCount - sourceFrameOffset);\n		const framesToExtract = Math.max(0, Math.min(frameCount, availableFrames));\n		if (framesToExtract === 0) return 0;\n		buffer.extract(target, sourceFrameOffset, framesToExtract);\n		return framesToExtract;\n	}\n	receive(frameCount) {\n		this.inputBuffer?.receive(frameCount);\n	}\n};\nvar CircularSampleBufferAdapter = class {\n	circularBuffer;\n	scratch;\n	constructor() {\n		this.circularBuffer = new CircularSampleBuffer();\n		this.scratch = new Float32Array(0);\n	}\n	get frameCount() {\n		return this.circularBuffer.frameCount;\n	}\n	clear() {\n		this.circularBuffer.clear();\n	}\n	syncFromInputBuffer(inputBuffer) {\n		if (inputBuffer instanceof FifoSampleBuffer) {\n			const frames = inputBuffer.frameCount;\n			if (frames === 0) return;\n			this.circularBuffer.pushSamples(inputBuffer.vector, inputBuffer.position, frames);\n			inputBuffer.receive(frames);\n			return;\n		}\n		const frames = inputBuffer.frameCount;\n		if (frames === 0) return;\n		const sampleCount = frames * 2;\n		if (this.scratch.length < sampleCount) this.scratch = new Float32Array(sampleCount);\n		inputBuffer.extract(this.scratch, 0, frames);\n		this.circularBuffer.pushSamples(this.scratch, 0, frames);\n		inputBuffer.receive(frames);\n	}\n	extract(target, sourceFrameOffset, frameCount) {\n		return this.circularBuffer.extract(target, sourceFrameOffset, frameCount, false);\n	}\n	receive(frameCount) {\n		this.circularBuffer.dropFrames(frameCount);\n	}\n};\n/** Creates an adapter that reads directly from any `SampleBuffer` contract. */\nvar createFifoSampleBufferAdapter = () => new FifoSampleBufferAdapter();\n/**\n* Creates an adapter that stages source frames in a circular buffer for\n* efficient repeated reads.\n*/\nvar createCircularSampleBufferAdapter = () => new CircularSampleBufferAdapter();\n//#endregion\n//#region ../interpolation-strategy-lanczos/.dist/index.js\nvar LANCZOS_DEFAULT_PARAMS = {\n	zeroCrossings: 4,\n	normalize: false\n};\nfunction normalizeLanczosParams(params, defaults) {\n	const merged = {\n		...defaults,\n		...params ?? {}\n	};\n	return {\n		zeroCrossings: Math.max(2, Math.min(8, Math.round(Number(merged["zeroCrossings"] ?? defaults["zeroCrossings"] ?? 4)))),\n		normalize: Boolean(merged["normalize"])\n	};\n}\nfunction applyLanczosParams(state, params) {\n	if (typeof state !== "object" || state === null) return;\n	const record = state;\n	record.params = {\n		zeroCrossings: Math.max(2, Math.round(Number(params["zeroCrossings"] ?? 4))),\n		normalize: Boolean(params["normalize"])\n	};\n}\nfunction readFrameSample(src, srcOffset, numFrames, frameIndex, channel, state) {\n	if (frameIndex < 0) return channel === 0 ? state.prevSampleL : state.prevSampleR;\n	if (frameIndex >= numFrames) return src[srcOffset + 2 * (numFrames - 1) + channel];\n	return src[srcOffset + 2 * frameIndex + channel];\n}\nfunction normalizedSinc(x) {\n	if (x === 0) return 1;\n	const value = Math.PI * x;\n	return Math.sin(value) / value;\n}\nfunction lanczosWeight(distance, radius) {\n	if (Math.abs(distance) >= radius) return 0;\n	return normalizedSinc(distance) * normalizedSinc(distance / radius);\n}\nvar lanczosKernel = (src, srcOffset, numFrames, position, channel, state) => {\n	const kernelState = state;\n	const radius = kernelState.params.zeroCrossings;\n	const normalize = Boolean(kernelState.params.normalize);\n	const center = Math.floor(position);\n	const start = center - (radius - 1);\n	const end = center + radius;\n	let numerator = 0;\n	let denominator = 0;\n	for (let sampleIndex = start; sampleIndex <= end; sampleIndex += 1) {\n		const weight = lanczosWeight(position - sampleIndex, radius);\n		numerator += readFrameSample(src, srcOffset, numFrames, sampleIndex, channel, kernelState) * weight;\n		denominator += weight;\n	}\n	if (Math.abs(denominator) < 1e-12) return readFrameSample(src, srcOffset, numFrames, Math.round(position), channel, kernelState);\n	return normalize ? numerator / denominator : numerator / (denominator || 1);\n};\nlanczosKernel.createState = () => ({\n	prevSampleL: 0,\n	prevSampleR: 0,\n	params: { ...LANCZOS_DEFAULT_PARAMS }\n});\n/** Default Lanczos strategy registration payload. */\nvar lanczosStrategy = {\n	id: "lanczos",\n	baseStrategy: "linear",\n	kernel: lanczosKernel,\n	defaultParams: LANCZOS_DEFAULT_PARAMS,\n	normalizeParams: normalizeLanczosParams,\n	applyParams: applyLanczosParams\n};\n//#endregion\n//#region ../core/src/interpolationStrategyRegistry.ts\nvar strategyRegistry = /* @__PURE__ */ new Map();\nvar activeStrategyId = "lanczos";\nfunction readStrategySelection(strategy) {\n	if (typeof strategy === "string") return { id: strategy };\n	if (strategy !== void 0) return strategy;\n	return { id: activeStrategyId };\n}\nfunction readStrategyId(strategy) {\n	return readStrategySelection(strategy).id;\n}\nfunction requireRegisteredStrategy(strategyId) {\n	const registered = strategyRegistry.get(strategyId);\n	if (registered !== void 0) return registered;\n	throw new Error(`Unknown interpolation strategy id "${strategyId}". Register it before use.`);\n}\nfunction registerBuiltInInterpolationStrategy(registration) {\n	const baseStrategy = registration.baseStrategy ?? "lanczos";\n	strategyRegistry.set(registration.id, {\n		id: registration.id,\n		baseStrategy,\n		builtIn: true,\n		kernel: registration.kernel,\n		defaultParams: { ...registration.defaultParams ?? {} },\n		normalizeParams: registration.normalizeParams,\n		applyParams: registration.applyParams\n	});\n}\nfunction resolveKernelRegistration(registration, visited = /* @__PURE__ */ new Set()) {\n	if (registration.kernel !== void 0) return registration;\n	if (visited.has(registration.id)) throw new Error(`Interpolation strategy resolution cycle detected at "${registration.id}".`);\n	visited.add(registration.id);\n	return resolveKernelRegistration(requireRegisteredStrategy(registration.baseStrategy), visited);\n}\nfunction normalizeParams(registration, params) {\n	const defaults = registration.defaultParams;\n	if (registration.normalizeParams !== void 0) return registration.normalizeParams(params, defaults);\n	const normalized = { ...defaults };\n	if (params !== void 0) {\n		for (const [key, value] of Object.entries(params)) if (value !== void 0) normalized[key] = value;\n	}\n	return normalized;\n}\n/**\n* Resolves a strategy to either a built-in base id or a plugin kernel.\n*\n* @throws Error when the strategy id is unknown.\n*/\nfunction resolveInterpolationStrategy(strategy) {\n	const registered = requireRegisteredStrategy(readStrategyId(strategy));\n	if ("kernel" in registered && registered.kernel) return registered.kernel;\n	return registered.baseStrategy;\n}\n/**\n* Resolves runtime strategy state (kernel + normalized params + applier hook).\n*/\nfunction resolveInterpolationStrategyRuntime(strategy) {\n	const selection = readStrategySelection(strategy);\n	const registered = requireRegisteredStrategy(selection.id);\n	const kernelRegistration = resolveKernelRegistration(registered);\n	const kernel = kernelRegistration.kernel;\n	if (kernel === void 0) throw new Error(`Interpolation strategy "${selection.id}" did not resolve to a kernel.`);\n	const params = normalizeParams(registered, selection.params);\n	return {\n		id: registered.id,\n		kernel,\n		params,\n		applyParams: registered.applyParams ?? kernelRegistration.applyParams\n	};\n}\nregisterBuiltInInterpolationStrategy({\n	...lanczosStrategy,\n	baseStrategy: "lanczos"\n});\n//#endregion\n//#region ../core/src/RateTransposer.ts\n/**\n* Sample rate transposer for pitch and tempo manipulation.\n*\n* @remarks\n* Used internally by SoundTouch for rate-based processing. Applies interpolation strategies to resample audio at different rates, supporting real-time pitch and tempo changes.\n*/\nvar RateTransposer = class RateTransposer extends AbstractSamplePipe {\n	/**\n	* Current rate factor for transposition.\n	*/\n	_rate;\n	/**\n	* Source position (in frames) for the next output sample, relative to the\n	* current processing block where 0 is the first frame and -1 is prevSample.\n	*/\n	fractionalPosition;\n	/**\n	* Previous left channel sample for interpolation.\n	*/\n	previousLeftSample;\n	/**\n	* Previous right channel sample for interpolation.\n	*/\n	previousRightSample;\n	/** Scratch space used for extracted input samples. */\n	inputScratch;\n	/** Scratch space used for generated output samples. */\n	outputScratch;\n	/** Factory used when cloning or initializing adapter strategy. */\n	sampleBufferAdapterFactory;\n	/** Factory used to construct input/output chain buffers. */\n	sampleBufferFactory;\n	/** Adapter that normalizes reads from the bound input buffer. */\n	inputAdapter;\n	/** Selected interpolation strategy for transposition. */\n	interpolationStrategy;\n	/** Resolved kernel used by this transposer instance. */\n	resolvedInterpolationKernel;\n	/** Optional per-instance state for plugin kernels. */\n	kernelState;\n	/** Normalized params for the selected interpolation strategy. */\n	interpolationStrategyParams;\n	/** Optional params application hook from the strategy registration. */\n	applyKernelParams;\n	/**\n	* Creates a RateTransposer instance.\n	* @param options Constructor options.\n	* @remarks\n	* Accepts factories for buffer and adapter creation, and allows specifying the interpolation strategy.\n	*/\n	constructor({ createBuffers = false, sampleBufferAdapterFactory = createCircularSampleBufferAdapter, sampleBufferFactory = () => new CircularSampleBuffer(), interpolationStrategy } = {}) {\n		super({\n			createBuffers,\n			inputBufferFactory: sampleBufferFactory,\n			outputBufferFactory: sampleBufferFactory\n		});\n		this.fractionalPosition = -1;\n		this.previousLeftSample = 0;\n		this.previousRightSample = 0;\n		this._rate = 1;\n		this.inputScratch = new Float32Array(0);\n		this.outputScratch = new Float32Array(0);\n		this.sampleBufferAdapterFactory = sampleBufferAdapterFactory;\n		this.sampleBufferFactory = sampleBufferFactory;\n		this.inputAdapter = sampleBufferAdapterFactory();\n		this.interpolationStrategy = "lanczos";\n		this.resolvedInterpolationKernel = () => 0;\n		this.kernelState = void 0;\n		this.interpolationStrategyParams = {};\n		this.applyKernelParams = void 0;\n		this.setInterpolationStrategy(interpolationStrategy ?? "lanczos");\n	}\n	/**\n	* Sets the rate factor for transposition.\n	* @param rate Rate factor.\n	*/\n	set rate(rate) {\n		this._rate = rate;\n	}\n	/**\n	* Active interpolation strategy.\n	* @returns The current interpolation strategy identifier.\n	*/\n	get strategy() {\n		return this.interpolationStrategy;\n	}\n	/**\n	* Active interpolation strategy params.\n	* @returns The current interpolation strategy parameters.\n	*/\n	get strategyParams() {\n		return { ...this.interpolationStrategyParams };\n	}\n	/**\n	* Switches interpolation strategy at runtime.\n	* @param strategy The new interpolation strategy to use.\n	*/\n	setInterpolationStrategy(strategy) {\n		const resolved = resolveInterpolationStrategyRuntime(strategy);\n		this.interpolationStrategy = resolved.id;\n		this.resolvedInterpolationKernel = resolved.kernel;\n		this.interpolationStrategyParams = { ...resolved.params };\n		this.applyKernelParams = resolved.applyParams;\n		if ("createState" in this.resolvedInterpolationKernel && typeof this.resolvedInterpolationKernel.createState === "function") this.kernelState = this.resolvedInterpolationKernel.createState();\n		else this.kernelState = void 0;\n		if (this.applyKernelParams !== void 0) this.applyKernelParams(this.kernelState, this.interpolationStrategyParams);\n		this.reset();\n	}\n	/**\n	* Applies a partial params update to the current interpolation strategy.\n	* @param params Partial set of parameters to update.\n	*/\n	setInterpolationStrategyParams(params) {\n		const nextParams = { ...this.interpolationStrategyParams };\n		for (const [key, value] of Object.entries(params)) if (value !== void 0) nextParams[key] = value;\n		this.interpolationStrategyParams = nextParams;\n		if (this.applyKernelParams !== void 0) this.applyKernelParams(this.kernelState, this.interpolationStrategyParams);\n	}\n	/**\n	* Resets internal state for interpolation.\n	* @remarks\n	* Clears previous sample values and resets the fractional position for output generation.\n	*/\n	reset() {\n		this.fractionalPosition = -1;\n		this.previousLeftSample = 0;\n		this.previousRightSample = 0;\n	}\n	/**\n	* Clears buffers and resets internal state.\n	* @remarks\n	* Calls clear on all internal buffers and resets interpolation state.\n	*/\n	clear() {\n		super.clear();\n		this.inputAdapter.clear();\n		this.reset();\n	}\n	/**\n	* Creates a clone of this RateTransposer with the same rate.\n	* @returns Cloned RateTransposer instance.\n	*/\n	clone() {\n		const result = new RateTransposer({\n			createBuffers: false,\n			sampleBufferAdapterFactory: this.sampleBufferAdapterFactory,\n			sampleBufferFactory: this.sampleBufferFactory,\n			interpolationStrategy: {\n				id: this.interpolationStrategy,\n				params: this.interpolationStrategyParams\n			}\n		});\n		result.rate = this._rate;\n		return result;\n	}\n	/**\n	* Processes input buffer and writes transposed samples to output buffer.\n	* @remarks\n	* Reads frames from the input buffer, applies rate transposition, and writes to the output buffer.\n	*/\n	process() {\n		if (this._inputBuffer === null || this._outputBuffer === null) return;\n		this.inputAdapter.syncFromInputBuffer(this._inputBuffer);\n		const numFrames = this.inputAdapter.frameCount;\n		if (numFrames === 0) return;\n		const numFramesOutput = this.transpose(numFrames);\n		this.inputAdapter.receive(numFrames);\n		if (numFramesOutput > 0) this._outputBuffer.putSamples(this.outputScratch, 0, numFramesOutput);\n	}\n	/**\n	* Ensures temporary scratch arrays are large enough for the current frame request and estimated output size.\n	*\n	* @param numInputFrames Number of input frames that will be processed.\n	* @remarks\n	* Allocates or resizes scratch arrays as needed for efficient processing.\n	*/\n	ensureScratchCapacity(numInputFrames) {\n		const inputSamples = numInputFrames * 2;\n		if (this.inputScratch.length < inputSamples) this.inputScratch = new Float32Array(inputSamples);\n		const estimatedOutputFrames = Math.ceil(numInputFrames / this._rate) + 2;\n		const outputSamples = Math.max(0, estimatedOutputFrames) * 2;\n		if (this.outputScratch.length < outputSamples) this.outputScratch = new Float32Array(outputSamples);\n	}\n	/**\n	* Transposes input samples by the current rate.\n	* @param numFrames Number of input frames to transpose.\n	* @returns Number of output frames written.\n	* @remarks\n	* Applies the selected interpolation kernel to generate output samples at the new rate.\n	*/\n	transpose(numFrames = 0) {\n		if (this._inputBuffer !== null) {\n			this.inputAdapter.syncFromInputBuffer(this._inputBuffer);\n			if (numFrames === 0) numFrames = this.inputAdapter.frameCount;\n		}\n		if (numFrames === 0) return 0;\n		this.ensureScratchCapacity(numFrames);\n		const src = this.inputScratch;\n		const extractedFrames = this.inputAdapter.extract(src, 0, numFrames);\n		if (extractedFrames === 0) return 0;\n		numFrames = extractedFrames;\n		return this.transposePluginKernel(numFrames);\n	}\n	/**\n	* Handles transposition using a plugin kernel.\n	* @remarks\n	* Invokes the selected interpolation kernel for each output sample.\n	*/\n	transposePluginKernel(numFrames) {\n		const src = this.inputScratch;\n		const dest = this.outputScratch;\n		const srcOffset = 0;\n		const destOffset = 0;\n		const kernel = this.resolvedInterpolationKernel;\n		const state = this.kernelState;\n		const stateRecord = this.getKernelStateRecord(state);\n		if (stateRecord !== void 0) {\n			stateRecord.prevSampleL = this.previousLeftSample;\n			stateRecord.prevSampleR = this.previousRightSample;\n		}\n		let i = 0;\n		let position = this.fractionalPosition;\n		const maxPosition = numFrames - 1;\n		while (position <= maxPosition) {\n			dest[destOffset + 2 * i] = kernel(src, srcOffset, numFrames, position, 0, state);\n			dest[destOffset + 2 * i + 1] = kernel(src, srcOffset, numFrames, position, 1, state);\n			i = i + 1;\n			position += this._rate;\n		}\n		this.fractionalPosition = position - numFrames;\n		this.previousLeftSample = src[srcOffset + 2 * numFrames - 2];\n		this.previousRightSample = src[srcOffset + 2 * numFrames - 1];\n		if (stateRecord !== void 0) {\n			stateRecord.prevSampleL = this.previousLeftSample;\n			stateRecord.prevSampleR = this.previousRightSample;\n		}\n		return i;\n	}\n	/**\n	* Returns the kernel state record if available.\n	* @param state The kernel state object.\n	* @returns The state record with previous sample values, or undefined if not present.\n	*/\n	getKernelStateRecord(state) {\n		if (typeof state !== "object" || state === null) return;\n		const record = state;\n		const prevSampleL = record["prevSampleL"];\n		const prevSampleR = record["prevSampleR"];\n		if (typeof prevSampleL === "number" && typeof prevSampleR === "number") return record;\n	}\n};\n//#endregion\n//#region ../core/src/Stretch.ts\n/**\n* Read adapter optimized for FIFO-backed buffers with a generic fallback path.\n*/\nvar FifoStretchBufferAdapter = class {\n	buffer;\n	fallbackBuffer;\n	fallbackScratch;\n	constructor() {\n		this.buffer = null;\n		this.fallbackBuffer = new FifoSampleBuffer();\n		this.fallbackScratch = new Float32Array(0);\n	}\n	/**\n	* @param buffer Source buffer to expose through FIFO-style reads.\n	*/\n	setBuffer(buffer) {\n		if (buffer instanceof FifoSampleBuffer) {\n			this.buffer = buffer;\n			return;\n		}\n		const frameCount = buffer.frameCount;\n		if (frameCount > 0) {\n			const sampleCount = frameCount * 2;\n			if (this.fallbackScratch.length < sampleCount) this.fallbackScratch = new Float32Array(sampleCount);\n			buffer.extract(this.fallbackScratch, 0, frameCount);\n			this.fallbackBuffer.clear();\n			this.fallbackBuffer.putSamples(this.fallbackScratch, 0, frameCount);\n			buffer.receive(frameCount);\n		} else this.fallbackBuffer.clear();\n		this.buffer = this.fallbackBuffer;\n	}\n	/**\n	* Returns the currently bound FIFO buffer.\n	* @throws Error when `setBuffer` has not been called yet.\n	*/\n	getBoundBuffer() {\n		if (this.buffer === null) throw new Error("buffer is not set");\n		return this.buffer;\n	}\n	get frameCount() {\n		return this.getBoundBuffer().frameCount;\n	}\n	get startIndex() {\n		return this.getBoundBuffer().startIndex;\n	}\n	readSample(sampleIndex) {\n		const boundBuffer = this.getBoundBuffer();\n		const start = boundBuffer.startIndex;\n		const end = start + boundBuffer.frameCount * 2;\n		if (sampleIndex < start || sampleIndex >= end) return 0;\n		return boundBuffer.vector[sampleIndex];\n	}\n	readSubarray(start, end) {\n		return this.getBoundBuffer().vector.subarray(start, end);\n	}\n	receive(numFrames) {\n		this.getBoundBuffer().receive(numFrames);\n	}\n	receiveSamples(output, numFrames) {\n		this.getBoundBuffer().receiveSamples(output, numFrames);\n	}\n};\nvar GenericStretchWriteBufferAdapter = class {\n	buffer;\n	constructor() {\n		this.buffer = null;\n	}\n	setOutputBuffer(buffer) {\n		this.buffer = buffer;\n	}\n	/**\n	* Returns the currently bound output buffer.\n	* @throws Error when `setOutputBuffer` has not been called.\n	*/\n	getBoundBuffer() {\n		if (this.buffer === null) throw new Error("output buffer is not set");\n		return this.buffer;\n	}\n	appendSamples(samples, numFrames) {\n		this.getBoundBuffer().putSamples(samples, 0, numFrames);\n	}\n	putFrom(source, position, numFrames) {\n		const sourceStart = source.startIndex + position * 2;\n		const sourceEnd = sourceStart + numFrames * 2;\n		const chunk = source.readSubarray(sourceStart, sourceEnd);\n		this.getBoundBuffer().putSamples(chunk, 0, numFrames);\n	}\n};\nvar CircularStretchInputBufferAdapter = class {\n	circularBuffer;\n	rangeScratch;\n	constructor() {\n		this.circularBuffer = new CircularSampleBuffer();\n		this.rangeScratch = new Float32Array(0);\n	}\n	/**\n	* Binds a source buffer and stages its readable frames into the internal\n	* circular storage.\n	*\n	* @param buffer Source buffer to import.\n	*/\n	setBuffer(buffer) {\n		if (buffer instanceof FifoSampleBuffer) {\n			const frames = buffer.frameCount;\n			if (frames > 0) {\n				this.circularBuffer.pushSamples(buffer.vector, buffer.position, frames);\n				buffer.receive(frames);\n			}\n			return;\n		}\n		const frames = buffer.frameCount;\n		if (frames > 0) {\n			const sampleCount = frames * 2;\n			if (this.rangeScratch.length < sampleCount) this.rangeScratch = new Float32Array(sampleCount);\n			buffer.extract(this.rangeScratch, 0, frames);\n			this.circularBuffer.pushSamples(this.rangeScratch, 0, frames);\n			buffer.receive(frames);\n		}\n	}\n	get frameCount() {\n		return this.circularBuffer.frameCount;\n	}\n	get startIndex() {\n		return 0;\n	}\n	readSample(sampleIndex) {\n		return this.circularBuffer.readSample(sampleIndex);\n	}\n	/**\n	* Returns a contiguous range from circular storage, padding trailing values\n	* with zeros when the requested range extends past available data.\n	*/\n	readSubarray(start, end) {\n		const normalizedStart = Math.max(0, Math.floor(start));\n		const requestedSamples = Math.max(normalizedStart, Math.floor(end)) - normalizedStart;\n		const requestedFrames = Math.floor(requestedSamples / 2);\n		if (requestedFrames <= 0) return this.rangeScratch.subarray(0, 0);\n		const needed = requestedFrames * 2;\n		if (this.rangeScratch.length < needed) this.rangeScratch = new Float32Array(needed);\n		const sourceFrameOffset = Math.floor(normalizedStart / 2);\n		const readSamples = this.circularBuffer.extract(this.rangeScratch, sourceFrameOffset, requestedFrames, false) * 2;\n		if (readSamples < needed) this.rangeScratch.fill(0, readSamples, needed);\n		return this.rangeScratch.subarray(0, needed);\n	}\n	receive(numFrames) {\n		this.circularBuffer.dropFrames(numFrames);\n	}\n	receiveSamples(output, numFrames) {\n		this.circularBuffer.extract(output, 0, numFrames, true);\n	}\n};\n/**\n* Creates a stretch input adapter that reads from FIFO-compatible buffers.\n*/\nvar createFifoStretchInputBufferAdapter = () => new FifoStretchBufferAdapter();\n/**\n* Creates a stretch input adapter backed by `CircularSampleBuffer`.\n*/\nvar createCircularStretchInputBufferAdapter = () => new CircularStretchInputBufferAdapter();\nvar DEFAULT_SEQUENCE_MS = 0;\nvar DEFAULT_SEEKWINDOW_MS = 0;\nvar DEFAULT_OVERLAP_MS = 8;\nvar AUTOSEQ_TEMPO_LOW = .25;\nvar AUTOSEQ_TEMPO_TOP = 4;\nvar AUTOSEQ_AT_MIN = 125;\nvar AUTOSEQ_AT_MAX = 50;\nvar AUTOSEQ_K = (AUTOSEQ_AT_MAX - AUTOSEQ_AT_MIN) / (AUTOSEQ_TEMPO_TOP - AUTOSEQ_TEMPO_LOW);\nvar AUTOSEQ_C = AUTOSEQ_AT_MIN - AUTOSEQ_K * AUTOSEQ_TEMPO_LOW;\nvar AUTOSEEK_AT_MIN = 25;\nvar AUTOSEEK_AT_MAX = 15;\nvar AUTOSEEK_K = (AUTOSEEK_AT_MAX - AUTOSEEK_AT_MIN) / (AUTOSEQ_TEMPO_TOP - AUTOSEQ_TEMPO_LOW);\nvar AUTOSEEK_C = AUTOSEEK_AT_MIN - AUTOSEEK_K * AUTOSEQ_TEMPO_LOW;\nvar NORMALIZED_CORRELATION_EPSILON = 1e-12;\nvar QUICK_SEEK_FALLBACK_THRESHOLD = 256;\nvar QUICK_SEEK_MIN_VALID_CANDIDATES = 8;\n/**\n* Time-stretch processor for tempo adjustment without affecting pitch.\n* Used internally by SoundTouch for time-stretching audio.\n*/\nvar Stretch = class Stretch extends AbstractSamplePipe {\n	inputBufferAdapterFactory;\n	sampleBufferFactory;\n	inputBufferAdapter;\n	outputBufferAdapter;\n	overlapScratch;\n	_quickSeek;\n	midBufferDirty;\n	midBuffer;\n	refMidBuffer;\n	refMidBufferEnergy;\n	overlapLength;\n	autoSeqSetting;\n	autoSeekSetting;\n	_tempo;\n	sampleRate;\n	_overlapMs;\n	sequenceMs;\n	seekWindowMs;\n	seekWindowLength;\n	seekLength;\n	nominalSkip;\n	skipFract;\n	sampleReq;\n	/**\n	* Creates a Stretch instance.\n	* @param options Constructor options.\n	*/\n	constructor({ sampleRate = 44100, createBuffers = false, inputBufferAdapterFactory = createFifoStretchInputBufferAdapter, sampleBufferFactory = () => new FifoSampleBuffer() } = {}) {\n		super({\n			createBuffers,\n			inputBufferFactory: sampleBufferFactory,\n			outputBufferFactory: sampleBufferFactory\n		});\n		this.inputBufferAdapterFactory = inputBufferAdapterFactory;\n		this.sampleBufferFactory = sampleBufferFactory;\n		this.inputBufferAdapter = inputBufferAdapterFactory();\n		this.outputBufferAdapter = new GenericStretchWriteBufferAdapter();\n		this.overlapScratch = new Float32Array(0);\n		this._quickSeek = true;\n		this.midBufferDirty = true;\n		this.midBuffer = null;\n		this.refMidBufferEnergy = 0;\n		this.overlapLength = 0;\n		this.autoSeqSetting = true;\n		this.autoSeekSetting = true;\n		this._tempo = 1;\n		this.setParameters(sampleRate, DEFAULT_SEQUENCE_MS, DEFAULT_SEEKWINDOW_MS, DEFAULT_OVERLAP_MS);\n	}\n	clear() {\n		super.clear();\n		this.clearMidBuffer();\n	}\n	clearMidBuffer() {\n		this.midBufferDirty = true;\n		if (this.midBuffer) this.midBuffer.fill(0);\n		if (this.refMidBuffer) this.refMidBuffer.fill(0);\n		this.skipFract = 0;\n	}\n	setParameters(sampleRate, sequenceMs, seekWindowMs, overlapMs) {\n		if (sampleRate > 0) this.sampleRate = sampleRate;\n		if (overlapMs > 0) this._overlapMs = overlapMs;\n		if (sequenceMs > 0) {\n			this.sequenceMs = sequenceMs;\n			this.autoSeqSetting = false;\n		} else this.autoSeqSetting = true;\n		if (seekWindowMs > 0) {\n			this.seekWindowMs = seekWindowMs;\n			this.autoSeekSetting = false;\n		} else this.autoSeekSetting = true;\n		this.calculateSequenceParameters();\n		this.calculateOverlapLength(this._overlapMs);\n		this.updateTempoDerivedState();\n	}\n	set tempo(newTempo) {\n		this._tempo = newTempo;\n		this.updateTempoDerivedState();\n	}\n	get tempo() {\n		return this._tempo;\n	}\n	get inputChunkSize() {\n		return this.sampleReq;\n	}\n	get outputChunkSize() {\n		return this.overlapLength + Math.max(0, this.seekWindowLength - 2 * this.overlapLength);\n	}\n	calculateOverlapLength(overlapInMsec = 0) {\n		let newOvl = this.sampleRate * overlapInMsec / 1e3;\n		newOvl = newOvl < 16 ? 16 : newOvl;\n		newOvl -= newOvl % 8;\n		if (newOvl === this.overlapLength && this.midBuffer !== null) return;\n		this.overlapLength = newOvl;\n		const needed = this.overlapLength * 2;\n		if (!this.refMidBuffer || this.refMidBuffer.length < needed) this.refMidBuffer = new Float32Array(needed);\n		if (!this.midBuffer || this.midBuffer.length < needed) this.midBuffer = new Float32Array(needed);\n	}\n	checkLimits(x, mi, ma) {\n		return x < mi ? mi : x > ma ? ma : x;\n	}\n	calculateSequenceParameters() {\n		if (this.autoSeqSetting) {\n			let seq = AUTOSEQ_C + AUTOSEQ_K * this._tempo;\n			seq = this.checkLimits(seq, AUTOSEQ_AT_MAX, AUTOSEQ_AT_MIN);\n			this.sequenceMs = Math.floor(seq + .5);\n		}\n		if (this.autoSeekSetting) {\n			let seek = AUTOSEEK_C + AUTOSEEK_K * this._tempo;\n			seek = this.checkLimits(seek, AUTOSEEK_AT_MAX, AUTOSEEK_AT_MIN);\n			this.seekWindowMs = Math.floor(seek + .5);\n		}\n		this.seekWindowLength = Math.floor(this.sampleRate * this.sequenceMs / 1e3);\n		this.seekLength = Math.floor(this.sampleRate * this.seekWindowMs / 1e3);\n		this.normalizeWindowInvariants();\n	}\n	normalizeWindowInvariants() {\n		this.seekLength = Math.max(1, this.seekLength);\n		this.seekWindowLength = Math.max(this.seekWindowLength, this.overlapLength);\n	}\n	updateTempoDerivedState() {\n		this.calculateSequenceParameters();\n		this.nominalSkip = this._tempo * (this.seekWindowLength - this.overlapLength);\n		this.skipFract = 0;\n		const intskip = Math.floor(this.nominalSkip + .5);\n		this.sampleReq = Math.max(intskip + this.overlapLength, this.seekWindowLength) + this.seekLength;\n	}\n	/**\n	* Whether the fast multi-pass seek algorithm is active.\n	* @returns `true` if quick seek is enabled (default); `false` for exhaustive search.\n	*/\n	get quickSeek() {\n		return this._quickSeek;\n	}\n	set quickSeek(enable) {\n		this._quickSeek = enable;\n	}\n	/**\n	* Current overlap crossfade length in milliseconds.\n	* @returns The overlap period used at the current sample rate.\n	*/\n	get overlapMs() {\n		return this._overlapMs;\n	}\n	/**\n	* Sets the overlap crossfade length and recalculates derived parameters.\n	* @param ms Overlap period in milliseconds (must be > 0).\n	*/\n	set overlapMs(ms) {\n		if (ms > 0) {\n			this._overlapMs = ms;\n			this.calculateOverlapLength(this._overlapMs);\n			this.calculateSequenceParameters();\n			this.updateTempoDerivedState();\n		}\n	}\n	/**\n	* Applies a partial set of WSOLA timing parameters.\n	*\n	* @remarks\n	* Only the provided fields are updated; omitted fields remain unchanged.\n	* Pass `sequenceMs: 0` or `seekWindowMs: 0` to switch that dimension back to auto-calculation.\n	*\n	* @param params Partial set of WSOLA timing parameters to apply.\n	*\n	* @example\n	* stretch.setStretchParameters({ overlapMs: 12, quickSeek: false });\n	*/\n	setStretchParameters(params) {\n		if (params.quickSeek !== void 0) this._quickSeek = params.quickSeek;\n		let needsRecalc = false;\n		if (params.sequenceMs !== void 0) {\n			if (params.sequenceMs > 0) {\n				this.sequenceMs = params.sequenceMs;\n				this.autoSeqSetting = false;\n			} else this.autoSeqSetting = true;\n			needsRecalc = true;\n		}\n		if (params.seekWindowMs !== void 0) {\n			if (params.seekWindowMs > 0) {\n				this.seekWindowMs = params.seekWindowMs;\n				this.autoSeekSetting = false;\n			} else this.autoSeekSetting = true;\n			needsRecalc = true;\n		}\n		if (params.overlapMs !== void 0 && params.overlapMs > 0) {\n			this._overlapMs = params.overlapMs;\n			this.calculateOverlapLength(this._overlapMs);\n			needsRecalc = true;\n		}\n		if (needsRecalc) {\n			this.calculateSequenceParameters();\n			this.updateTempoDerivedState();\n		}\n	}\n	clone() {\n		const result = new Stretch({\n			createBuffers: false,\n			inputBufferAdapterFactory: this.inputBufferAdapterFactory,\n			sampleBufferFactory: this.sampleBufferFactory\n		});\n		result.tempo = this._tempo;\n		result.setParameters(this.sampleRate, this.sequenceMs, this.seekWindowMs, this._overlapMs);\n		return result;\n	}\n	seekBestOverlapPosition(inputBuffer) {\n		const resolvedInputBuffer = inputBuffer ?? this.getInputBufferAdapter();\n		if (!this._quickSeek || this.seekLength <= QUICK_SEEK_FALLBACK_THRESHOLD) return this.seekBestOverlapPositionStereo(resolvedInputBuffer);\n		return this.seekBestOverlapPositionStereoQuick(resolvedInputBuffer);\n	}\n	seekBestOverlapPositionStereo(inputBuffer) {\n		let bestOffset;\n		let bestCorrelation;\n		let correlation;\n		this.preCalculateCorrelationReferenceStereo();\n		bestOffset = 0;\n		bestCorrelation = -Infinity;\n		for (let i = 0; i < this.seekLength; i++) {\n			correlation = this.calculateCrossCorrelationStereo(2 * i, this.refMidBuffer, inputBuffer);\n			if (correlation > bestCorrelation) {\n				bestCorrelation = correlation;\n				bestOffset = i;\n			}\n		}\n		return bestOffset;\n	}\n	seekBestOverlapPositionStereoQuick(inputBuffer) {\n		let bestOffset;\n		let bestCorrelation;\n		let correlation;\n		let correlationOffset;\n		let tempOffset;\n		let evaluatedCandidates;\n		this.preCalculateCorrelationReferenceStereo();\n		bestCorrelation = this.calculateCrossCorrelationStereo(0, this.refMidBuffer, inputBuffer);\n		evaluatedCandidates = 1;\n		bestOffset = 0;\n		correlationOffset = 0;\n		for (let scanCount = 0; scanCount < 4; scanCount++) {\n			let previousTempOffset = Number.MIN_SAFE_INTEGER;\n			const scanOffsets = this.getQuickScanOffsets(scanCount);\n			for (const scanOffset of scanOffsets) {\n				tempOffset = correlationOffset + scanOffset;\n				if (tempOffset === previousTempOffset) continue;\n				previousTempOffset = tempOffset;\n				if (tempOffset < 0) continue;\n				if (tempOffset >= this.seekLength) continue;\n				correlation = this.calculateCrossCorrelationStereo(2 * tempOffset, this.refMidBuffer, inputBuffer);\n				evaluatedCandidates++;\n				if (correlation > bestCorrelation) {\n					bestCorrelation = correlation;\n					bestOffset = tempOffset;\n				}\n			}\n			correlationOffset = bestOffset;\n		}\n		if (evaluatedCandidates < QUICK_SEEK_MIN_VALID_CANDIDATES) return this.seekBestOverlapPositionStereo(inputBuffer);\n		return bestOffset;\n	}\n	getQuickScanOffsets(stage) {\n		const maxOffset = Math.max(1, this.seekLength - 1);\n		if (stage === 0) return this.generateFractionalScanOffsets(maxOffset, 2, 1, 14, 24);\n		if (stage === 1) return this.generateSymmetricScanOffsets(maxOffset, .2);\n		if (stage === 2) return this.generateSymmetricScanOffsets(maxOffset, .06);\n		return this.generateSymmetricScanOffsets(maxOffset, .015);\n	}\n	generateFractionalScanOffsets(maxOffset, startNumerator, stepNumerator, denominator, steps) {\n		const offsets = [];\n		const seen = /* @__PURE__ */ new Set();\n		const safeDenominator = Math.max(1, denominator);\n		const safeSteps = Math.max(1, steps);\n		for (let i = 0; i < safeSteps; i++) {\n			const numerator = startNumerator + i * stepNumerator;\n			const value = Math.round(maxOffset * numerator / safeDenominator);\n			if (value <= 0 || value >= this.seekLength || seen.has(value)) continue;\n			seen.add(value);\n			offsets.push(value);\n		}\n		return offsets;\n	}\n	generateSymmetricScanOffsets(maxOffset, spanRatio) {\n		const span = Math.max(1, Math.round(maxOffset * spanRatio));\n		const scales = [\n			1,\n			.75,\n			.5,\n			.25\n		];\n		const negative = [];\n		const positive = [];\n		const seen = /* @__PURE__ */ new Set();\n		for (const scale of scales) {\n			const magnitude = Math.max(1, Math.round(span * scale));\n			const neg = -magnitude;\n			const pos = magnitude;\n			if (!seen.has(neg)) {\n				seen.add(neg);\n				negative.push(neg);\n			}\n			if (!seen.has(pos)) {\n				seen.add(pos);\n				positive.push(pos);\n			}\n		}\n		return negative.concat(positive);\n	}\n	preCalculateCorrelationReferenceStereo() {\n		let energy = 0;\n		for (let i = 0; i < this.overlapLength; i++) {\n			const temp = i * (this.overlapLength - i);\n			const ctx = i * 2;\n			const left = this.midBuffer[ctx] * temp;\n			const right = this.midBuffer[ctx + 1] * temp;\n			this.refMidBuffer[ctx] = left;\n			this.refMidBuffer[ctx + 1] = right;\n			energy += left * left + right * right;\n		}\n		this.refMidBufferEnergy = energy;\n	}\n	calculateCrossCorrelationStereo(mixingPos, compare, inputBuffer) {\n		mixingPos += inputBuffer.startIndex;\n		let dot = 0;\n		let sourceEnergy = 0;\n		const calcLength = 2 * this.overlapLength;\n		const source = inputBuffer.readSubarray(mixingPos, mixingPos + calcLength);\n		for (let i = 0; i < calcLength; i += 2) {\n			const sourceLeft = i < source.length ? source[i] : 0;\n			const sourceRight = i + 1 < source.length ? source[i + 1] : 0;\n			const compareLeft = compare[i];\n			const compareRight = compare[i + 1];\n			dot += sourceLeft * compareLeft + sourceRight * compareRight;\n			sourceEnergy += sourceLeft * sourceLeft + sourceRight * sourceRight;\n		}\n		if (sourceEnergy <= NORMALIZED_CORRELATION_EPSILON || this.refMidBufferEnergy <= NORMALIZED_CORRELATION_EPSILON) return -1;\n		return dot / Math.sqrt(sourceEnergy * this.refMidBufferEnergy);\n	}\n	overlapStereo(inputPosition, inputBuffer, outputBuffer) {\n		inputPosition += inputBuffer.startIndex;\n		const overlapSamples = this.overlapLength * 2;\n		if (this.overlapScratch.length < overlapSamples) this.overlapScratch = new Float32Array(overlapSamples);\n		const output = this.overlapScratch;\n		const input = inputBuffer.readSubarray(inputPosition, inputPosition + overlapSamples);\n		const frameScale = 1 / this.overlapLength;\n		for (let i = 0; i < this.overlapLength; i++) {\n			const tempFrame = (this.overlapLength - i) * frameScale;\n			const fi = i * frameScale;\n			const ctx = 2 * i;\n			const inputLeft = ctx < input.length ? input[ctx] : 0;\n			const inputRight = ctx + 1 < input.length ? input[ctx + 1] : 0;\n			output[ctx] = inputLeft * fi + this.midBuffer[ctx] * tempFrame;\n			output[ctx + 1] = inputRight * fi + this.midBuffer[ctx + 1] * tempFrame;\n		}\n		outputBuffer.appendSamples(output, this.overlapLength);\n	}\n	process() {\n		const inputBuffer = this.getInputBufferAdapter();\n		const outputBuffer = this.getOutputBufferAdapter();\n		if (!this.bootstrapMidBuffer(inputBuffer)) return;\n		while (inputBuffer.frameCount >= this.sampleReq) this.processOneWindow(inputBuffer, outputBuffer);\n	}\n	bootstrapMidBuffer(inputBuffer) {\n		if (!this.midBufferDirty) return true;\n		if (inputBuffer.frameCount < this.overlapLength) return false;\n		const needed = this.overlapLength * 2;\n		if (!this.midBuffer || this.midBuffer.length < needed) this.midBuffer = new Float32Array(needed);\n		inputBuffer.receiveSamples(this.midBuffer, this.overlapLength);\n		this.midBufferDirty = false;\n		return true;\n	}\n	processOneWindow(inputBuffer, outputBuffer) {\n		const offset = this.seekBestOverlapPosition(inputBuffer);\n		this.overlapStereo(2 * Math.floor(offset), inputBuffer, outputBuffer);\n		const middleFrames = this.seekWindowLength - 2 * this.overlapLength;\n		if (middleFrames > 0) outputBuffer.putFrom(inputBuffer, offset + this.overlapLength, middleFrames);\n		this.captureOverlapHistory(offset, inputBuffer);\n		this.advanceInputByNominalSkip(inputBuffer);\n	}\n	captureOverlapHistory(offset, inputBuffer) {\n		const start = inputBuffer.startIndex + 2 * (offset + this.seekWindowLength - this.overlapLength);\n		this.midBuffer.set(inputBuffer.readSubarray(start, start + 2 * this.overlapLength));\n	}\n	advanceInputByNominalSkip(inputBuffer) {\n		this.skipFract += this.nominalSkip;\n		const overlapSkip = Math.floor(this.skipFract);\n		this.skipFract -= overlapSkip;\n		inputBuffer.receive(overlapSkip);\n	}\n	getInputBufferAdapter() {\n		if (this._inputBuffer === null) throw new Error("inputBuffer is not set");\n		this.inputBufferAdapter.setBuffer(this._inputBuffer);\n		return this.inputBufferAdapter;\n	}\n	getOutputBufferAdapter() {\n		if (this._outputBuffer === null) throw new Error("outputBuffer is not set");\n		this.outputBufferAdapter.setOutputBuffer(this._outputBuffer);\n		return this.outputBufferAdapter;\n	}\n};\n//#endregion\n//#region ../core/src/testFloatEqual.ts\n/**\n* Tests whether two floating-point numbers differ beyond a fixed epsilon.\n*\n* @param a First number to compare.\n* @param b Second number to compare.\n* @returns True when the numbers differ by more than epsilon, false otherwise.\n* @remarks\n* Uses a fixed epsilon threshold to determine significant difference.\n*/\nfunction isFloatDifferent(a, b) {\n	return (a > b ? a - b : b - a) > 1e-10;\n}\n//#endregion\n//#region ../core/src/SoundTouch.ts\n/**\n* Main processing engine for pitch shifting and time-stretching.\n*\n* @remarks\n* Chains a `RateTransposer` and `Stretch` stage to deliver real-time pitch manipulation\n* without affecting playback tempo. Set `pitch`, `pitchOctaves`, or `pitchSemitones` to\n* control the output. The internal `_rate` and `_tempo` pipeline values are derived\n* automatically from `virtualPitch`.\n*/\nvar SoundTouch = class SoundTouch {\n	transposer;\n	stretch;\n	_sampleRate;\n	_sampleBufferType;\n	_sampleBufferFactory;\n	_interpolationStrategy;\n	_inputBuffer;\n	_intermediateBuffer;\n	_outputBuffer;\n	_rate;\n	_tempo;\n	/** Current pitch multiplier. Updated by the `pitch`, `pitchOctaves`, and `pitchSemitones` setters. */\n	virtualPitch;\n	/**\n	* Creates a new SoundTouch processor instance.\n	* @param options Construction options for sample rate, buffer strategy, and factories.\n	*/\n	constructor(options = {}) {\n		this._sampleBufferType = options.sampleBufferType ?? "circular";\n		this._sampleBufferFactory = options.sampleBufferFactory ?? (this._sampleBufferType === "fifo" ? () => new FifoSampleBuffer() : () => new CircularSampleBuffer());\n		this.transposer = new RateTransposer({\n			createBuffers: false,\n			sampleBufferAdapterFactory: this._sampleBufferType === "circular" ? createCircularSampleBufferAdapter : createFifoSampleBufferAdapter,\n			sampleBufferFactory: this._sampleBufferFactory,\n			interpolationStrategy: options.interpolationStrategy\n		});\n		this._interpolationStrategy = this.transposer.strategy;\n		this._sampleRate = options.sampleRate ?? 44100;\n		if (options.stretchFactory) this.stretch = options.stretchFactory(this._sampleRate, {\n			sampleBufferFactory: this._sampleBufferFactory,\n			sampleBufferType: this._sampleBufferType\n		});\n		else this.stretch = new Stretch({\n			sampleRate: this._sampleRate,\n			createBuffers: false,\n			inputBufferAdapterFactory: this._sampleBufferType === "circular" ? createCircularStretchInputBufferAdapter : createFifoStretchInputBufferAdapter,\n			sampleBufferFactory: this._sampleBufferFactory\n		});\n		this.stretch.setParameters(this._sampleRate, 0, 0, 0);\n		this._inputBuffer = this._sampleBufferFactory();\n		this._intermediateBuffer = this._sampleBufferFactory();\n		this._outputBuffer = this._sampleBufferFactory();\n		this._rate = 0;\n		this._tempo = 0;\n		this.virtualPitch = 1;\n		this.calculateEffectiveRateAndTempo();\n	}\n	/**\n	* Clears both processing stages and their internal buffers.\n	* @remarks\n	* Resets the state of the transposer and stretch stages, including all internal buffers.\n	*/\n	clear() {\n		this.transposer.clear();\n		this.stretch.clear();\n	}\n	/**\n	* Creates an independent copy with equivalent runtime configuration.\n	*/\n	clone() {\n		const result = new SoundTouch({\n			sampleRate: this._sampleRate,\n			sampleBufferType: this._sampleBufferType,\n			sampleBufferFactory: this._sampleBufferFactory,\n			interpolationStrategy: {\n				id: this._interpolationStrategy,\n				params: this.transposer.strategyParams\n			}\n		});\n		result.pitch = this.virtualPitch;\n		return result;\n	}\n	/**\n	* Active interpolation strategy id used by the transposer stage.\n	* @returns The current interpolation strategy identifier.\n	*/\n	get interpolationStrategy() {\n		return this._interpolationStrategy;\n	}\n	/**\n	* Active interpolation strategy params used by the transposer stage.\n	* @returns The current interpolation strategy parameters.\n	*/\n	get interpolationStrategyParams() {\n		return this.transposer.strategyParams;\n	}\n	/**\n	* Switches interpolation strategy at runtime.\n	* @param strategy The new interpolation strategy to use.\n	*/\n	setInterpolationStrategy(strategy) {\n		this.transposer.setInterpolationStrategy(strategy);\n		this._interpolationStrategy = this.transposer.strategy;\n	}\n	/**\n	* Applies a partial runtime params update to the current strategy.\n	* @param params Partial set of parameters to update.\n	*/\n	setInterpolationStrategyParams(params) {\n		this.transposer.setInterpolationStrategyParams(params);\n	}\n	/**\n	* Applies a partial set of WSOLA timing parameters to the stretch stage.\n	*\n	* @remarks\n	* Delegates directly to {@link Stretch.setStretchParameters}. Only the provided\n	* fields are updated; omitted fields remain unchanged. Pass `sequenceMs: 0` or\n	* `seekWindowMs: 0` to switch that dimension back to auto-calculation.\n	*\n	* @param params Partial set of WSOLA timing parameters to apply.\n	*\n	* @example\n	* st.setStretchParameters({ overlapMs: 12, quickSeek: false });\n	*/\n	setStretchParameters(params) {\n		this.stretch.setStretchParameters(params);\n	}\n	/**\n	* Sets the pitch multiplier and recomputes the derived pipeline rate and tempo.\n	*\n	* @remarks\n	* Internally sets `_rate = pitch` and `_tempo = 1 / pitch`, rewiring the\n	* Transposer\u2192Stretch stage order when pitch > 1.\n	*/\n	set pitch(pitch) {\n		this.virtualPitch = pitch;\n		this.calculateEffectiveRateAndTempo();\n	}\n	/**\n	* Sets pitch by octave offset.\n	*/\n	set pitchOctaves(pitchOctaves) {\n		this.pitch = Math.exp(.69314718056 * pitchOctaves);\n		this.calculateEffectiveRateAndTempo();\n	}\n	/**\n	* Sets pitch by semitone offset.\n	*/\n	set pitchSemitones(pitchSemitones) {\n		this.pitchOctaves = pitchSemitones / 12;\n	}\n	/**\n	* Input buffer for upstream interleaved stereo frames.\n	* @returns The input buffer for writing audio frames.\n	*/\n	get inputBuffer() {\n		return this._inputBuffer;\n	}\n	/**\n	* Output buffer that downstream consumers read from.\n	* @returns The output buffer for reading processed audio frames.\n	*/\n	get outputBuffer() {\n		return this._outputBuffer;\n	}\n	/**\n	* Recomputes the effective pipeline rate/tempo from `virtualPitch` and rewires stage order when needed.\n	*\n	* @remarks\n	* `_rate` is set to `virtualPitch`; `_tempo` to `1 / virtualPitch`. When `_rate > 1` the\n	* Stretch stage feeds the Transposer; otherwise the order is reversed.\n	*/\n	calculateEffectiveRateAndTempo() {\n		const previousTempo = this._tempo;\n		const previousRate = this._rate;\n		this._tempo = 1 / this.virtualPitch;\n		this._rate = this.virtualPitch;\n		if (isFloatDifferent(this._tempo, previousTempo)) this.stretch.tempo = this._tempo;\n		if (isFloatDifferent(this._rate, previousRate)) this.transposer.rate = this._rate;\n		if (this._rate > 1) {\n			if (this._outputBuffer !== this.transposer.outputBuffer) {\n				this.stretch.inputBuffer = this._inputBuffer;\n				this.stretch.outputBuffer = this._intermediateBuffer;\n				this.transposer.inputBuffer = this._intermediateBuffer;\n				this.transposer.outputBuffer = this._outputBuffer;\n			}\n		} else if (this._outputBuffer !== this.stretch.outputBuffer) {\n			this.transposer.inputBuffer = this._inputBuffer;\n			this.transposer.outputBuffer = this._intermediateBuffer;\n			this.stretch.inputBuffer = this._intermediateBuffer;\n			this.stretch.outputBuffer = this._outputBuffer;\n		}\n	}\n	/**\n	* Runs one processing step through the currently selected stage order.\n	* @remarks\n	* Processes available frames through the pipeline, updating output buffers.\n	*/\n	process() {\n		if (this._rate > 1) {\n			this.stretch.process();\n			this.transposer.process();\n		} else {\n			this.transposer.process();\n			this.stretch.process();\n		}\n	}\n};\n//#endregion\n//#region ../worklet-base/src/SoundTouchProcessorBase.ts\n/**\n* Abstract base class for all SoundTouchJS AudioWorklet processor implementations.\n*\n* @remarks\n* Centralises shared state (pipe, sample buffers, runtime-update queue), the\n* `applyPendingRuntimeUpdates` helper, and the core DSP pipeline in\n* `processCore`. Subclasses must implement `process` and `onProcessComplete`.\n*\n* The default `process` implementation calls `applyPendingRuntimeUpdates`,\n* `processCore`, and then `onProcessComplete`. Subclasses that need to\n* interleave additional logic (e.g. LPC analysis) can override `beforePipeProcess`\n* and/or `extractSamples` instead of overriding `process` entirely.\n*/\nvar SoundTouchProcessorBase = class extends AudioWorkletProcessor {\n	/** The SoundTouch DSP pipeline instance. */\n	_pipe;\n	/** Interleaved (L, R, L, R, \u2026) input staging buffer. */\n	_samples;\n	/** Interleaved output staging buffer populated by `extractSamples`. */\n	_outputSamples;\n	/** Cumulative count of render blocks where the output buffer ran short. */\n	_underrunCount = 0;\n	/** Total render blocks processed since construction. */\n	_blockCount = 0;\n	_pendingInterpolationStrategy = null;\n	_pendingInterpolationStrategyParams = null;\n	_pendingStretchParameters = null;\n	/** Label used in console messages (e.g. `\'[SoundTouchProcessor]\'`). */\n	processorLabel;\n	/**\n	* Validates and resolves an interpolation strategy id, falling back to\n	* `\'lanczos\'` if the id is unrecognised.\n	*\n	* @remarks\n	* Call this as a static expression inside the `super()` argument list of a\n	* subclass constructor so that strategy resolution happens before pipe creation.\n	*\n	* @param strategy - The strategy id provided by the caller.\n	* @param processorLabel - Label included in the fallback console message.\n	* @returns The original `strategy` if valid, or `\'lanczos\'` as a fallback.\n	*/\n	static resolveStrategy(strategy, processorLabel) {\n		try {\n			if (strategy) resolveInterpolationStrategy(strategy);\n			return strategy;\n		} catch {\n			console.info(`${processorLabel} Unknown interpolation strategy id:`, strategy, "\u2014 falling back to lanczos.");\n			return "lanczos";\n		}\n	}\n	/**\n	* @param processorLabel - Label string used in diagnostic messages.\n	* @param pipeOptions - Options forwarded to the `SoundTouch` constructor. The\n	*   `sampleRate` global must be available in the AudioWorklet scope.\n	*/\n	constructor(processorLabel, pipeOptions) {\n		super();\n		this.processorLabel = processorLabel;\n		this._pipe = new SoundTouch(pipeOptions);\n		this._samples = new Float32Array(256);\n		this._outputSamples = new Float32Array(256);\n		const port = this.port;\n		if (port !== void 0) port.onmessage = (event) => {\n			const message = event.data;\n			if (message.type === "set-interpolation-strategy") {\n				this._pendingInterpolationStrategy = message.strategy;\n				return;\n			}\n			if (message.type === "set-interpolation-strategy-params") {\n				this._pendingInterpolationStrategyParams = message.params;\n				return;\n			}\n			if (message.type === "set-stretch-parameters") this._pendingStretchParameters = message.params;\n		};\n	}\n	/**\n	* Flushes any pending interpolation-strategy or stretch-parameter change\n	* that arrived via `port.onmessage` since the last render block.\n	*\n	* @remarks\n	* Call this at the top of `process` before touching `_pipe`.\n	*/\n	applyPendingRuntimeUpdates() {\n		if (this._pendingInterpolationStrategy !== null) {\n			try {\n				this._pipe.setInterpolationStrategy(this._pendingInterpolationStrategy);\n			} catch {\n				console.info(`${this.processorLabel} Failed to switch interpolation strategy:`, this._pendingInterpolationStrategy);\n			}\n			this._pendingInterpolationStrategy = null;\n		}\n		if (this._pendingInterpolationStrategyParams !== null) {\n			try {\n				this._pipe.setInterpolationStrategyParams(this._pendingInterpolationStrategyParams);\n			} catch {\n				console.info(`${this.processorLabel} Failed to update interpolation strategy params.`);\n			}\n			this._pendingInterpolationStrategyParams = null;\n		}\n		if (this._pendingStretchParameters !== null) {\n			try {\n				this._pipe.setStretchParameters(this._pendingStretchParameters);\n			} catch {\n				console.info(`${this.processorLabel} Failed to update stretch parameters.`);\n			}\n			this._pendingStretchParameters = null;\n		}\n	}\n	/**\n	* Optional hook called after input routing and buffer resize but **before**\n	* the SoundTouch pipe processes the block.\n	*\n	* @remarks\n	* Override in subclasses that need to inspect or transform the raw input\n	* before it enters the DSP pipeline (e.g. computing LPC coefficients).\n	*\n	* @param _leftInput - Left-channel input for this render block.\n	* @param _rightInput - Right-channel input (same as left for mono sources).\n	* @param _frameCount - Number of frames in this block.\n	* @param _parameters - AudioParam k-rate values for this render block.\n	*/\n	beforePipeProcess(_leftInput, _rightInput, _frameCount, _parameters) {}\n	/**\n	* Extracts rendered frames from the output buffer, writes them to\n	* `leftOutput`/`rightOutput`, zero-fills any gap, and returns RMS/peak metrics.\n	*\n	* @remarks\n	* Override in subclasses that apply post-extraction transforms (e.g. formant\n	* correction). Overrides are responsible for the full extraction, write-back,\n	* silence fill, and returning `{ outputRms, outputPeak }`.\n	*\n	* @param leftOutput - Destination view for the left channel.\n	* @param rightOutput - Destination view for the right channel.\n	* @param frameCount - Total frames expected in this block.\n	* @param toExtract - Frames available to extract (\u2264 frameCount).\n	* @param _parameters - AudioParam k-rate values (available for overrides).\n	* @returns RMS and peak of the extracted block.\n	*/\n	extractSamples(leftOutput, rightOutput, frameCount, toExtract, _parameters) {\n		let outputRms = 0;\n		let outputPeak = 0;\n		if (toExtract > 0) {\n			const extracted = this._outputSamples;\n			this._pipe.outputBuffer.extract(extracted, 0, toExtract);\n			this._pipe.outputBuffer.receive(toExtract);\n			let sumSq = 0;\n			let peak = 0;\n			for (let i = 0; i < toExtract; i++) {\n				const l = extracted[i * 2];\n				const r = extracted[i * 2 + 1];\n				leftOutput[i] = Number.isFinite(l) ? l : 0;\n				rightOutput[i] = Number.isFinite(r) ? r : 0;\n				sumSq += l * l + r * r;\n				peak = Math.max(peak, Math.abs(l), Math.abs(r));\n			}\n			outputRms = Math.sqrt(sumSq / (toExtract * 2));\n			outputPeak = peak;\n		}\n		for (let i = toExtract; i < frameCount; i++) {\n			leftOutput[i] = 0;\n			rightOutput[i] = 0;\n		}\n		return {\n			outputRms,\n			outputPeak\n		};\n	}\n	/**\n	* Runs the full DSP pipeline for one render block and returns metrics.\n	*\n	* @remarks\n	* Handles input routing, buffer resize, `beforePipeProcess`, pitch\n	* calculation, sample interleaving, pipe feed/process, counter updates,\n	* and `extractSamples`. Returns `null` when the input is empty or\n	* the output has not been allocated, keeping the processor alive.\n	*\n	* @param inputs - AudioWorklet input buses.\n	* @param outputs - AudioWorklet output buses.\n	* @param parameters - k-rate AudioParam values.\n	* @returns Render-block result, or `null` if inputs are not ready.\n	*/\n	processCore(inputs, outputs, parameters) {\n		const input = inputs[0];\n		const output = outputs[0];\n		if (!input || !input.length || !output[0] || !output[0].length) return null;\n		const leftInput = input[0];\n		const rightInput = input.length > 1 ? input[1] : input[0];\n		const leftOutput = output[0];\n		const rightOutput = output.length > 1 ? output[1] : output[0];\n		const frameCount = leftInput.length;\n		if (this._samples.length < frameCount * 2) {\n			this._samples = new Float32Array(frameCount * 2);\n			this._outputSamples = new Float32Array(frameCount * 2);\n		}\n		this.beforePipeProcess(leftInput, rightInput, frameCount, parameters);\n		const pitch = parameters["pitch"][0];\n		const pitchSemitones = parameters["pitchSemitones"][0];\n		const playbackRate = parameters["playbackRate"][0];\n		this._pipe.pitch = pitch * Math.pow(2, pitchSemitones / 12) / playbackRate;\n		const samples = this._samples;\n		for (let i = 0; i < frameCount; i++) {\n			samples[i * 2] = leftInput[i];\n			samples[i * 2 + 1] = rightInput[i];\n		}\n		this._pipe.inputBuffer.putSamples(samples, 0, frameCount);\n		this._pipe.process();\n		const available = this._pipe.outputBuffer.frameCount;\n		const toExtract = Math.min(available, frameCount);\n		this._blockCount++;\n		if (available < frameCount) this._underrunCount++;\n		const { outputRms, outputPeak } = this.extractSamples(leftOutput, rightOutput, frameCount, toExtract, parameters);\n		return {\n			frameCount,\n			toExtract,\n			available,\n			leftInput,\n			rightInput,\n			leftOutput,\n			rightOutput,\n			outputRms,\n			outputPeak\n		};\n	}\n	/**\n	* AudioWorkletProcessor render callback. Keeps the processor alive by always returning `true`.\n	*\n	* @remarks\n	* The default implementation calls `applyPendingRuntimeUpdates`, `processCore`,\n	* and `onProcessComplete`. Override only when the execution order must differ\n	* (e.g. pre-pipe analysis steps not covered by `beforePipeProcess`).\n	*\n	* @param inputs - AudioWorklet input buses.\n	* @param outputs - AudioWorklet output buses.\n	* @param parameters - k-rate AudioParam values.\n	* @returns Always `true` to keep the processor alive.\n	*/\n	process(inputs, outputs, parameters) {\n		this.applyPendingRuntimeUpdates();\n		const result = this.processCore(inputs, outputs, parameters);\n		if (result !== null) this.onProcessComplete(result);\n		return true;\n	}\n};\n//#endregion\n//#region ../worklet-base/src/types.ts\n/**\n* Standard pitch, pitchSemitones, and playbackRate AudioParam descriptors\n* shared by all SoundTouchJS worklet processors.\n*/\nvar STANDARD_PARAMETER_DESCRIPTORS = [\n	{\n		name: "pitch",\n		defaultValue: 1,\n		minValue: .1,\n		maxValue: 8,\n		automationRate: "k-rate"\n	},\n	{\n		name: "pitchSemitones",\n		defaultValue: 0,\n		minValue: -24,\n		maxValue: 24,\n		automationRate: "k-rate"\n	},\n	{\n		name: "playbackRate",\n		defaultValue: 1,\n		minValue: .1,\n		maxValue: 8,\n		automationRate: "k-rate"\n	}\n];\n//#endregion\n//#region src/processor.ts\nvar PROCESSOR_NAME = "soundtouch-processor";\n/**\n* Audio render-thread processor that applies SoundTouch transformations to stereo blocks.\n*\n* @remarks\n* Receives audio from the main thread, applies pitch, tempo, and rate transformations,\n* and outputs processed stereo audio. Handles runtime strategy switching via messages.\n*/\nvar SoundTouchProcessor = class extends SoundTouchProcessorBase {\n	/** Static AudioParam metadata consumed by the browser. */\n	static get parameterDescriptors() {\n		return STANDARD_PARAMETER_DESCRIPTORS;\n	}\n	/**\n	* @param options Worklet constructor options provided by the main thread.\n	*\n	* @remarks\n	* Unknown interpolation strategy ids are logged and coerced to `lanczos`\n	* so render-thread startup remains resilient.\n	*/\n	constructor(options) {\n		super("[SoundTouchProcessor]", {\n			sampleRate,\n			sampleBufferType: options?.processorOptions?.sampleBufferType ?? "circular",\n			interpolationStrategy: SoundTouchProcessorBase.resolveStrategy(options?.processorOptions?.interpolationStrategy, "[SoundTouchProcessor]")\n		});\n	}\n	onProcessComplete(result) {\n		if (this._blockCount % 100 === 0) this.port.postMessage({\n			type: "metrics",\n			framesBuffered: result.available,\n			underrunCount: this._underrunCount,\n			blockCount: this._blockCount,\n			outputRms: result.outputRms,\n			outputPeak: result.outputPeak\n		});\n	}\n};\nregisterProcessor(PROCESSOR_NAME, SoundTouchProcessor);\n//#endregion\n\n//# sourceMappingURL=soundtouch-processor.js.map';

  // src/recorder.txt
  var recorder_default = "// Minimal PCM tap: forwards input frames to the main thread for MP3/WAV encoding.\nclass RecorderProcessor extends AudioWorkletProcessor {\n  process(inputs) {\n    const input = inputs[0];\n    if (input && input.length) {\n      const l = input[0] || new Float32Array(128);\n      const r = input[1] || input[0] || new Float32Array(128);\n      this.port.postMessage([l.slice(0), r.slice(0)]);\n    }\n    return true;\n  }\n}\nregisterProcessor('recorder-processor', RecorderProcessor);\n";

  // src/main.js
  var stWorkletUrl = () => URL.createObjectURL(new Blob([processor_default], { type: "application/javascript" }));
  var recWorkletUrl = () => URL.createObjectURL(new Blob([recorder_default], { type: "application/javascript" }));
  var $ = (s) => document.querySelector(s);
  var $$ = (s) => Array.from(document.querySelectorAll(s));
  var clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  var fmt = (sec) => {
    if (!isFinite(sec)) return "--:--";
    const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    return m + ":" + String(s).padStart(2, "0");
  };
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove("show"), 2600);
  }
  var ctx = null;
  var master;
  var comp;
  var analyser;
  var echoDelay;
  var echoFeedback;
  var echoWet;
  var recNode;
  var recZero;
  var workletsReady = false;
  async function initAudio() {
    if (ctx) {
      if (ctx.state === "suspended") await ctx.resume();
      return;
    }
    ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: "playback" });
    await SoundTouchNode.register(ctx, stWorkletUrl());
    await ctx.audioWorklet.addModule(recWorkletUrl());
    workletsReady = true;
    master = ctx.createGain();
    master.gain.value = 0.9;
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -6;
    comp.ratio.value = 4;
    comp.knee.value = 12;
    analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    master.connect(comp);
    comp.connect(ctx.destination);
    comp.connect(analyser);
    echoDelay = ctx.createDelay(1);
    echoDelay.delayTime.value = 0.32;
    echoFeedback = ctx.createGain();
    echoFeedback.gain.value = 0.35;
    echoWet = ctx.createGain();
    echoWet.gain.value = 0;
    master.connect(echoDelay);
    echoDelay.connect(echoFeedback);
    echoFeedback.connect(echoDelay);
    echoDelay.connect(echoWet);
    echoWet.connect(comp);
    recNode = new AudioWorkletNode(ctx, "recorder-processor");
    recZero = ctx.createGain();
    recZero.gain.value = 0;
    master.connect(recNode);
    recNode.connect(recZero);
    recZero.connect(ctx.destination);
    recNode.port.onmessage = (e) => Recorder.onChunk(e.data);
    decks.a.buildGraph();
    decks.b.buildGraph();
    const x = ($("#xfader") ? $("#xfader").value : 50) / 100;
    decks.a.xf.gain.value = Math.cos(x * Math.PI / 2);
    decks.b.xf.gain.value = Math.sin(x * Math.PI / 2);
  }
  var Deck = class {
    constructor(id) {
      this.id = id;
      this.buffer = null;
      this.playing = false;
      this.offset = 0;
      this.startedAt = 0;
      this.tempo = 1;
      this.src = null;
      this.name = null;
      this.bpm = null;
      this.loopOn = false;
      this.loopStart = 0;
      this.loopEnd = 0;
      this.st = null;
      this.eqHi = null;
      this.eqMid = null;
      this.eqLow = null;
      this.filter = null;
      this.gain = null;
      this.xf = null;
      this.peaks = null;
    }
    buildGraph() {
      this.st = new SoundTouchNode({ context: ctx });
      this.eqHi = ctx.createBiquadFilter();
      this.eqHi.type = "highshelf";
      this.eqHi.frequency.value = 4e3;
      this.eqMid = ctx.createBiquadFilter();
      this.eqMid.type = "peaking";
      this.eqMid.frequency.value = 1e3;
      this.eqMid.Q.value = 0.8;
      this.eqLow = ctx.createBiquadFilter();
      this.eqLow.type = "lowshelf";
      this.eqLow.frequency.value = 250;
      this.filter = ctx.createBiquadFilter();
      this.filter.type = "lowpass";
      this.filter.frequency.value = 19e3;
      this.gain = ctx.createGain();
      this.gain.gain.value = this.id === "a" ? 0.8 : 0.65;
      this.xf = ctx.createGain();
      this.xf.gain.value = Math.SQRT1_2;
      this.st.connect(this.eqHi);
      this.eqHi.connect(this.eqMid);
      this.eqMid.connect(this.eqLow);
      this.eqLow.connect(this.filter);
      this.filter.connect(this.gain);
      this.gain.connect(this.xf);
      this.xf.connect(master);
    }
    async loadFile(file) {
      await initAudio();
      const ab = await file.arrayBuffer();
      const buf = await ctx.decodeAudioData(ab);
      this.setBuffer(buf, file.name.replace(/\.[^.]+$/, ""));
    }
    setBuffer(buf, name) {
      this.stopSource();
      this.buffer = buf;
      this.offset = 0;
      this.playing = false;
      this.name = name;
      this.peaks = computePeaks(buf, 800);
      updateDeckUI(this);
    }
    pos() {
      if (!this.buffer) return 0;
      if (!this.playing) return this.offset;
      let raw = this.offset + (ctx.currentTime - this.startedAt) * this.tempo;
      if (this.loopOn && this.loopEnd > this.loopStart && raw > this.loopEnd) {
        raw = this.loopStart + (raw - this.loopStart) % (this.loopEnd - this.loopStart);
      }
      return Math.min(this.buffer.duration, raw);
    }
    play() {
      if (!this.buffer || this.playing) return;
      if (this.offset >= this.buffer.duration - 0.05) this.offset = 0;
      const src = ctx.createBufferSource();
      src.buffer = this.buffer;
      src.playbackRate.value = this.tempo;
      this.st.playbackRate.value = this.tempo;
      if (this.loopOn) {
        src.loop = true;
        src.loopStart = this.loopStart;
        src.loopEnd = Math.min(this.loopEnd, this.buffer.duration);
      }
      src.connect(this.st);
      src.onended = () => {
        if (this.src === src) {
          this.playing = false;
          this.offset = 0;
          updateDeckUI(this);
        }
      };
      src.start(0, this.offset);
      this.src = src;
      this.startedAt = ctx.currentTime;
      this.playing = true;
      updateDeckUI(this);
    }
    stopSource() {
      if (this.src) {
        try {
          this.src.onended = null;
          this.src.stop();
        } catch (e) {
        }
        this.src = null;
      }
    }
    pause() {
      if (!this.playing) return;
      this.offset = this.pos();
      this.stopSource();
      this.playing = false;
      updateDeckUI(this);
    }
    cue() {
      this.pause();
      this.offset = 0;
      updateDeckUI(this);
    }
    toggleLoop() {
      if (!this.buffer) return;
      if (!this.loopOn) {
        const beats = 4;
        const bpm = this.bpm || 120;
        const len = beats * 60 / bpm;
        this.loopStart = this.pos();
        if (this.loopStart + len > this.buffer.duration) this.loopStart = Math.max(0, this.buffer.duration - len);
        this.loopEnd = this.loopStart + len;
        this.loopOn = true;
      } else {
        this.loopOn = false;
      }
      if (this.playing) {
        const p = this.pos();
        this.stopSource();
        this.offset = p;
        this.playing = false;
        this.play();
      }
      updateDeckUI(this);
    }
    setTempo(t) {
      if (this.playing) {
        this.offset = this.pos();
        this.startedAt = ctx.currentTime;
        if (this.src) this.src.playbackRate.value = t;
      }
      this.tempo = t;
      if (this.st) this.st.playbackRate.value = t;
    }
    setVolume(v) {
      if (this.gain) this.gain.gain.value = v;
    }
    setEQ(band, db) {
      const n = band === "hi" ? this.eqHi : band === "mid" ? this.eqMid : this.eqLow;
      if (n) n.gain.value = db;
    }
    setFilter(norm) {
      if (!this.filter) return;
      const f = 19e3 * Math.pow(200 / 19e3, 1 - norm);
      this.filter.frequency.value = clamp(f, 200, 19e3);
    }
  };
  var decks = { a: new Deck("a"), b: new Deck("b") };
  function computePeaks(buf, n) {
    const ch = buf.getChannelData(0);
    const block = Math.floor(ch.length / n) || 1;
    const peaks = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let max = 0;
      const start = i * block;
      for (let j = 0; j < block; j += 16) {
        const v = Math.abs(ch[start + j] || 0);
        if (v > max) max = v;
      }
      peaks[i] = max;
    }
    return peaks;
  }
  function drawWave(deck) {
    const canvas = $(`[data-canvas="${deck.id}"]`);
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 2;
    const w = canvas.clientWidth * dpr, h = canvas.clientHeight * dpr;
    if (!w || !h) return;
    canvas.width = w;
    canvas.height = h;
    const c = canvas.getContext("2d");
    c.clearRect(0, 0, w, h);
    const light = document.body.classList.contains("light");
    const col = deck.id === "a" ? light ? "#0e7490" : "#22d3ee" : light ? "#be185d" : "#f472b6";
    const mid = h / 2;
    const frac = deck.buffer ? deck.pos() / deck.buffer.duration : 0;
    const bars = Math.floor(w / (3 * dpr));
    const grad = c.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, col);
    grad.addColorStop(1, col + "88");
    c.fillStyle = grad;
    if (deck.peaks) {
      for (let i = 0; i < bars; i++) {
        const p = deck.peaks[Math.floor(i / bars * deck.peaks.length)] || 0;
        const amp = Math.max(1.5 * dpr, p * (mid - 3 * dpr));
        c.fillRect(i * 3 * dpr, mid - amp, 2 * dpr, amp * 2);
      }
    } else {
      let s = deck.id === "a" ? 1234567 : 987654;
      const rnd = () => (s = s * 16807 % 2147483647) / 2147483647;
      for (let i = 0; i < bars; i++) {
        const env = Math.sin(i / bars * Math.PI) * 0.35 + 0.65;
        const amp = (0.25 + rnd() * 0.75) * env * (mid - 4 * dpr);
        c.fillRect(i * 3 * dpr, mid - amp, 2 * dpr, amp * 2);
      }
    }
    c.fillStyle = light ? "rgba(238,241,246,.55)" : "rgba(8,9,13,.55)";
    c.fillRect(w * frac, 0, w, h);
    const ph = $(`[data-ph="${deck.id}"]`);
    ph.style.display = deck.buffer ? "block" : "none";
    ph.style.left = (frac * 100).toFixed(2) + "%";
    $(`[data-time="${deck.id}"]`).textContent = fmt(deck.pos()) + " / " + fmt(deck.buffer ? deck.buffer.duration : NaN);
  }
  function estimateBPM(buf) {
    const ch = buf.getChannelData(0), sr = buf.sampleRate;
    const hop = 512, win = 1024;
    const frames = Math.floor(ch.length / hop);
    if (frames < 200) return null;
    const env = new Float32Array(frames);
    for (let f = 0; f < frames; f++) {
      let e = 0;
      for (let j = 0; j < win; j += 4) {
        const v = ch[f * hop + j] || 0;
        e += v * v;
      }
      env[f] = e;
    }
    const on = new Float32Array(frames);
    for (let f = 1; f < frames; f++) on[f] = Math.max(0, env[f] - env[f - 1]);
    const fps = sr / hop;
    const minLag = Math.floor(fps * 60 / 200), maxLag = Math.ceil(fps * 60 / 60);
    let best = 0, bestV = 0;
    for (let lag = minLag; lag <= maxLag; lag++) {
      let v = 0;
      for (let f = 0; f + lag < frames; f++) v += on[f] * on[f + lag];
      if (v > bestV) {
        bestV = v;
        best = lag;
      }
    }
    if (!best) return null;
    return Math.round(60 * fps / best);
  }
  function genDemoBeat(bpm, variant) {
    const sr = ctx ? ctx.sampleRate : 44100;
    const beats = 32, spb = 60 / bpm;
    const dur = beats * spb;
    const buf = (ctx || new OfflineAudioContext(2, sr, sr)).createBuffer(2, Math.ceil(dur * sr), sr);
    const L = buf.getChannelData(0), R = buf.getChannelData(1);
    const kick = (t) => {
      const start = Math.floor(t * sr), len = Math.floor(0.25 * sr);
      for (let i = 0; i < len && start + i < L.length; i++) {
        const tt = i / sr, f = 140 * Math.exp(-tt * 30) + 45;
        const v = Math.sin(2 * Math.PI * f * tt) * Math.exp(-tt * 14) * 0.9;
        L[start + i] += v;
        R[start + i] += v;
      }
    };
    const hat = (t, open) => {
      const start = Math.floor(t * sr), len = Math.floor((open ? 0.12 : 0.04) * sr);
      let seed = 22222;
      for (let i = 0; i < len && start + i < L.length; i++) {
        seed = seed * 16807 % 2147483647;
        const v = (seed / 2147483647 * 2 - 1) * Math.exp(-i / sr * (open ? 30 : 90)) * 0.25;
        L[start + i] += v * 0.7;
        R[start + i] += v * 0.9;
      }
    };
    const bass = (t, freq, lenS) => {
      const start = Math.floor(t * sr), len = Math.floor(lenS * sr);
      for (let i = 0; i < len && start + i < L.length; i++) {
        const tt = i / sr;
        const v = (Math.sin(2 * Math.PI * freq * tt) + 0.3 * Math.sin(4 * Math.PI * freq * tt)) * Math.min(1, tt * 60) * Math.exp(-tt * 3) * 0.32;
        L[start + i] += v;
        R[start + i] += v;
      }
    };
    const scaleA = [55, 55, 65.4, 55, 49, 55, 58.3, 65.4];
    const scaleB = [61.7, 61.7, 73.4, 61.7, 55, 61.7, 65.4, 73.4];
    const scale = variant === "a" ? scaleA : scaleB;
    for (let b = 0; b < beats; b++) {
      const t = b * spb;
      kick(t);
      if (variant === "a" || b % 2 === 1) kick(t + spb * 0.5 * (variant === "a" ? 0 : 0));
      hat(t + spb * 0.5, b % 4 === 3);
      if (variant === "b" && b % 2 === 1) hat(t + spb * 0.25, false);
      bass(t, scale[b % 8], spb * 0.9);
    }
    let max = 0;
    for (let i = 0; i < L.length; i++) {
      const v = Math.abs(L[i]);
      if (v > max) max = v;
    }
    const g = max > 0 ? 0.85 / max : 1;
    for (let i = 0; i < L.length; i++) {
      L[i] *= g;
      R[i] *= g;
    }
    return buf;
  }
  var Recorder = {
    recording: false,
    chunks: [],
    lastBlob: null,
    start() {
      this.chunks = [];
      this.recording = true;
      $("#recBtn").classList.add("on");
      $("#recBtnBig").classList.add("lit");
      $("#recBtnBig").innerHTML = "\u23F9 STOP";
      toast("Recording your mix...");
    },
    onChunk(d) {
      if (!this.recording) return;
      this.chunks.push([new Float32Array(d[0]), new Float32Array(d[1])]);
    },
    stop() {
      this.recording = false;
      $("#recBtn").classList.remove("on");
      $("#recBtnBig").classList.remove("lit");
      $("#recBtnBig").innerHTML = "\u23FA RECORD";
      const total = this.chunks.reduce((n, c) => n + c[0].length, 0);
      if (total < ctx.sampleRate * 0.5) {
        toast("Too short - record at least a second");
        return;
      }
      const left = new Float32Array(total), right = new Float32Array(total);
      let o = 0;
      for (const [l, r] of this.chunks) {
        left.set(l, o);
        right.set(r, o);
        o += l.length;
      }
      this.chunks = [];
      let blob;
      if (window.lamejs) {
        blob = encodeMp3(left, right, ctx.sampleRate);
      } else {
        blob = encodeWav(left, right, ctx.sampleRate);
      }
      this.lastBlob = blob;
      const btn = $("#exportBtn");
      btn.disabled = false;
      downloadBlob(blob);
    }
  };
  function toInt16(f) {
    const out = new Int16Array(f.length);
    for (let i = 0; i < f.length; i++) {
      const v = clamp(f[i], -1, 1);
      out[i] = v < 0 ? v * 32768 : v * 32767;
    }
    return out;
  }
  function encodeMp3(l, r, sr) {
    const enc = new lamejs.Mp3Encoder(2, sr, 192);
    const li = toInt16(l), ri = toInt16(r);
    const parts = [], bs = 1152;
    for (let i = 0; i < li.length; i += bs) {
      const d = enc.encodeBuffer(li.subarray(i, i + bs), ri.subarray(i, i + bs));
      if (d.length) parts.push(new Uint8Array(d));
    }
    const end = enc.flush();
    if (end.length) parts.push(new Uint8Array(end));
    return new Blob(parts, { type: "audio/mpeg" });
  }
  function encodeWav(l, r, sr) {
    const li = toInt16(l), ri = toInt16(r);
    const n = li.length, buf = new ArrayBuffer(44 + n * 4), v = new DataView(buf);
    const ws = (o2, s) => {
      for (let i = 0; i < s.length; i++) v.setUint8(o2 + i, s.charCodeAt(i));
    };
    ws(0, "RIFF");
    v.setUint32(4, 36 + n * 4, true);
    ws(8, "WAVE");
    ws(12, "fmt ");
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true);
    v.setUint16(22, 2, true);
    v.setUint32(24, sr, true);
    v.setUint32(28, sr * 4, true);
    v.setUint16(32, 4, true);
    v.setUint16(34, 16, true);
    ws(36, "data");
    v.setUint32(40, n * 4, true);
    let o = 44;
    for (let i = 0; i < n; i++) {
      v.setInt16(o, li[i], true);
      v.setInt16(o + 2, ri[i], true);
      o += 4;
    }
    return new Blob([buf], { type: "audio/wav" });
  }
  function downloadBlob(blob) {
    const ext = blob.type === "audio/mpeg" ? "mp3" : "wav";
    const name = "dj-mix-" + (/* @__PURE__ */ new Date()).toISOString().slice(11, 19).replace(/:/g, "") + "." + ext;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5e3);
    toast("Mix saved: " + name);
  }
  function updateDeckUI(deck) {
    const id = deck.id;
    $(`[data-name="${id}"]`).textContent = deck.name || "No track loaded";
    $(`[data-sub="${id}"]`).textContent = deck.buffer ? fmt(deck.buffer.duration) + " \u2022 ready" : "Load a song or tap DEMO";
    $(`[data-play="${id}"]`).textContent = deck.playing ? "\u23F8" : "\u25B6";
    if (deck.buffer) {
      const bpm = estimateBPM(deck.buffer);
      deck.bpm = bpm;
      const badge = $(`[data-bpm="${id}"]`);
      if (bpm) {
        badge.textContent = "~" + bpm + " BPM";
        badge.style.display = "block";
      }
    }
    const loopBtn = $(`[data-loop="${id}"]`);
    if (loopBtn) loopBtn.classList.toggle("lit", deck.loopOn);
    drawWave(deck);
  }
  function setSliderFill(el) {
    el.style.setProperty("--fill", (el.value - el.min) / (el.max - el.min) * 100 + "%");
  }
  function bindUI() {
    if (new URLSearchParams(location.search).has("light")) document.body.classList.add("light");
    $("#themeBtn").onclick = () => {
      document.body.classList.toggle("light");
      drawWave(decks.a);
      drawWave(decks.b);
    };
    for (const id of ["a", "b"]) {
      const input = $("#file" + id.toUpperCase());
      $(`[data-load="${id}"]`).onclick = () => input.click();
      input.onchange = async () => {
        if (!input.files[0]) return;
        try {
          await decks[id].loadFile(input.files[0]);
          toast("Loaded on deck " + id.toUpperCase());
        } catch (e) {
          toast("Could not read that audio file");
        }
        input.value = "";
      };
      $(`[data-demo="${id}"]`).onclick = async () => {
        await initAudio();
        decks[id].setBuffer(genDemoBeat(id === "a" ? 126 : 100, id), id === "a" ? "Demo Beat 126" : "Demo Groove 100");
        toast("Demo track on deck " + id.toUpperCase());
      };
      $(`[data-play="${id}"]`).onclick = async () => {
        await initAudio();
        const d = decks[id];
        if (!d.buffer) {
          toast("Load a song or tap DEMO first");
          return;
        }
        d.playing ? d.pause() : d.play();
      };
      $(`[data-cue="${id}"]`).onclick = () => decks[id].cue();
      $(`[data-loop="${id}"]`).onclick = () => {
        decks[id].toggleLoop();
        toast(decks[id].loopOn ? "Loop on (4 beats) - deck " + id.toUpperCase() : "Loop off - deck " + id.toUpperCase());
      };
      $(`[data-wave="${id}"]`).onclick = (e) => {
        const d = decks[id];
        if (!d.buffer) return;
        const r = e.currentTarget.getBoundingClientRect();
        const frac = clamp((e.clientX - r.left) / r.width, 0, 1);
        const wasPlaying = d.playing;
        if (wasPlaying) d.pause();
        d.offset = frac * d.buffer.duration;
        if (wasPlaying) d.play();
        else updateDeckUI(d);
      };
    }
    $$("[data-slider]").forEach((el) => {
      setSliderFill(el);
      el.oninput = async () => {
        setSliderFill(el);
        await initAudio();
        const d = decks[el.dataset.deck];
        if (el.dataset.slider === "tempo") {
          const pct = (el.value - 50) / 50 * 8;
          d.setTempo(1 + pct / 100);
          $(`[data-tempoval="${el.dataset.deck}"]`).textContent = (pct >= 0 ? "+" : "") + pct.toFixed(1) + "%";
        } else {
          d.setVolume(el.value / 100);
          $(`[data-volval="${el.dataset.deck}"]`).textContent = el.value;
        }
      };
    });
    const xf = $("#xfader");
    setSliderFill(xf);
    xf.oninput = async () => {
      setSliderFill(xf);
      await initAudio();
      const x = xf.value / 100;
      decks.a.xf.gain.value = Math.cos(x * Math.PI / 2);
      decks.b.xf.gain.value = Math.sin(x * Math.PI / 2);
    };
    $$("[data-knob]").forEach((dial) => {
      const param = dial.dataset.knob;
      let val = param === "master" ? 0.62 : param === "echo" || param === "filter" ? 0.12 : 0.5;
      const apply = () => {
        dial.style.setProperty("--rot", -135 + val * 270 + "deg");
        if (!workletsReady) return;
        if (param === "master") master.gain.value = val * 1.3;
        else if (param === "echo") echoWet.gain.value = val * 0.8;
        else if (param === "filter") decks[dial.dataset.deck].setFilter(1 - val);
        else decks[dial.dataset.deck].setEQ(param, (val - 0.5) * 30);
      };
      apply();
      let sy = 0, sv = 0;
      dial.addEventListener("pointerdown", (e) => {
        sy = e.clientY;
        sv = val;
        dial.setPointerCapture(e.pointerId);
        const move = async (ev) => {
          val = clamp(sv + (sy - ev.clientY) / 130, 0, 1);
          if (!ctx) await initAudio();
          apply();
        };
        const up = () => {
          dial.removeEventListener("pointermove", move);
          dial.removeEventListener("pointerup", up);
        };
        dial.addEventListener("pointermove", move);
        dial.addEventListener("pointerup", up);
      });
    });
    const toggleRec = async () => {
      await initAudio();
      Recorder.recording ? Recorder.stop() : Recorder.start();
    };
    $("#recBtn").onclick = toggleRec;
    $("#recBtnBig").onclick = toggleRec;
    $("#exportBtn").onclick = () => {
      if (Recorder.lastBlob) downloadBlob(Recorder.lastBlob);
    };
    $("#fxBtn").onclick = async () => {
      await initAudio();
      const on = $("#fxBtn").classList.toggle("lit");
      echoFeedback.gain.value = on ? 0.5 : 0.35;
      echoWet.gain.value = on ? 0.6 : 0;
      toast(on ? "Echo FX on" : "Echo FX off");
    };
    const tick = () => {
      for (const d of [decks.a, decks.b]) {
        if (d.buffer) {
          if (d.playing && d.pos() >= d.buffer.duration - 0.03) {
            d.playing = false;
            d.offset = 0;
            d.stopSource();
            updateDeckUI(d);
          }
          drawWave(d);
        }
      }
      requestAnimationFrame(tick);
    };
    tick();
  }
  async function selfTest() {
    const out = [];
    const ok = (name, cond, extra) => out.push((cond ? "PASS" : "FAIL") + " " + name + (extra ? " " + extra : ""));
    const div = $("#selftest");
    div.style.display = "block";
    try {
      await initAudio();
      ok("audio-init", !!ctx && workletsReady, "state=" + ctx.state + " sr=" + ctx.sampleRate);
      decks.a.setBuffer(genDemoBeat(126, "a"), "testA");
      decks.b.setBuffer(genDemoBeat(100, "b"), "testB");
      ok(
        "demo-buffers",
        decks.a.buffer.duration > 10 && decks.b.buffer.duration > 10,
        "a=" + decks.a.buffer.duration.toFixed(1) + "s b=" + decks.b.buffer.duration.toFixed(1) + "s"
      );
      const est = estimateBPM(decks.a.buffer);
      ok("bpm-estimate", !!est && Math.abs(est - 126) <= 4, "est=" + est);
      decks.a.play();
      decks.b.play();
      decks.a.setTempo(1.06);
      decks.b.setVolume(0.5);
      decks.a.setEQ("low", 9);
      decks.b.setFilter(0.5);
      const t0 = ctx.currentTime;
      await new Promise((r) => setTimeout(r, 1200));
      const adv = ctx.currentTime - t0;
      ok("realtime-advance", adv > 0.5, "advanced=" + adv.toFixed(2) + "s state=" + ctx.state);
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteTimeDomainData(data);
      let peak = 0;
      for (const v of data) peak = Math.max(peak, Math.abs(v - 128));
      ok("realtime-signal", peak > 2, "peak=" + peak);
      decks.a.pause();
      decks.b.pause();
      const octx = new OfflineAudioContext(2, 44100 * 2, 44100);
      await SoundTouchNode.register(octx, stWorkletUrl());
      const osrc = octx.createBufferSource();
      osrc.buffer = decks.a.buffer;
      osrc.playbackRate.value = 1.25;
      const ost = new SoundTouchNode({ context: octx });
      ost.playbackRate.value = 1.25;
      const og = octx.createGain();
      og.gain.value = 0.7;
      osrc.connect(ost);
      ost.connect(og);
      og.connect(octx.destination);
      osrc.start(0, 0, 2);
      const rendered = await octx.startRendering();
      const rd = rendered.getChannelData(0);
      let rpeak = 0;
      for (let i = 0; i < rd.length; i += 7) rpeak = Math.max(rpeak, Math.abs(rd[i]));
      ok("offline-render-soundtouch", rpeak > 0.01, "peak=" + rpeak.toFixed(3));
      const mp3 = encodeMp3(rd, rendered.getChannelData(1), 44100);
      ok("mp3-encode", mp3.size > 5e3, "bytes=" + mp3.size);
      const wav = encodeWav(rd, rendered.getChannelData(1), 44100);
      ok("wav-encode", wav.size > 1e5, "bytes=" + wav.size);
    } catch (e) {
      out.push("FAIL exception " + (e && e.message));
    }
    const text = out.join("\n");
    div.textContent = text;
    document.title = out.some((l) => l.startsWith("FAIL")) ? "SELFTEST-FAIL" : "SELFTEST-PASS";
  }
  window.__dj = { decks, Recorder, initAudio, genDemoBeat };
  window.addEventListener("DOMContentLoaded", () => {
    bindUI();
    drawWave(decks.a);
    drawWave(decks.b);
    if (new URLSearchParams(location.search).has("selftest")) selfTest();
  });
  window.addEventListener("resize", () => {
    drawWave(decks.a);
    drawWave(decks.b);
  });
})();
