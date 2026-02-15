# Continuator: A Lightweight AI Music Continuation Engine

## What Is This?

Continuator is a music generation system that extends your existing musical ideas. Give it a few bars of MIDI, and it writes what comes next — maintaining your style, structure, and musical intent.

It is not trying to compose music from scratch. It is not a general-purpose creative AI. It is a focused tool: you provide a musical phrase, and it continues it coherently. Think of it as an auto-complete for music.

---

## Why Does This Exist?

Most AI music tools fall into one of two camps: either they are massive cloud-based models that generate entire tracks from text prompts, or they are simple pattern-matching systems that repeat what they've heard. Neither is particularly useful if you're a musician sitting in front of a DAW, working on a piece, and wanting help extending an idea you've already started.

Continuator sits in a different space entirely. It is designed to:

- **Run locally.** No cloud API, no subscription, no internet connection required. The model is small enough to run on a consumer GPU — or even a CPU if you're patient.
- **Work with quantized MIDI.** It operates on the same grid-aligned note data that DAWs use natively. Notes snap to beat divisions, velocities are discrete, timing is precise. The output drops straight into your project with no cleanup needed.
- **Continue, not compose.** It respects what you've already written. The generated continuation follows from your musical context — your key, your rhythm, your phrasing.

The core idea is simple: a small, fast model that lives inside your creative workflow rather than replacing it.

---

## How It Works (The Short Version)

The system has three components that work together during training, but only two are needed at generation time.

### The Decoder (Musical Memory)

A pretrained Transformer network that has learned general musical knowledge from a large corpus of MIDI data. It reads your input phrase and builds an internal representation — essentially understanding the musical context: what key you're in, what rhythmic patterns are at play, what the harmonic trajectory looks like.

The decoder is frozen. It was trained once and never changes after that. It serves as a stable foundation of musical understanding.

### The Adapter (The Creative Voice)

A small, lightweight network that sits on top of the decoder. It takes the decoder's understanding of your music and decides what note to write next. Then the next. Then the next — one token at a time, autoregressively, until the continuation is complete.

The adapter is where all the learning happens. It is deliberately small: roughly a tenth the size of the decoder. This is by design. A small adapter means fast inference, low memory usage, and the ability to fine-tune it for different styles or purposes without needing significant compute.

Because the adapter starts as a near-identity function (initially just passing through the decoder's predictions), it begins with all the decoder's musical knowledge intact and gradually learns to refine and improve upon it.

### The Discriminator (The Critic)

A separate network that learns to judge whether a musical continuation sounds like it belongs with the piece that preceded it. During training, it sees both real continuations (from the training data) and generated ones (from the adapter), and learns to tell the difference.

The discriminator's judgment is used as a reward signal: the adapter is trained via reinforcement learning to produce continuations that the discriminator considers convincing. This creates a productive tension — the adapter gets better at generating, the discriminator gets better at judging, and the quality of the output improves over time.

The discriminator evaluates music at multiple levels simultaneously:
- **Note-level:** Are individual notes well-chosen? Do pitches and durations make sense in context?
- **Bar-level:** Do entire bars hold together as coherent musical phrases?
- **Structural level:** Do the bars follow one another in a musically logical order?

At generation time, the discriminator is not needed. You only run the decoder and adapter.

---

## The Training Process

Training uses a method called Self-Critical Sequence Training (SCST), borrowed from research in text generation and image captioning, adapted here for music.

The core idea: at each training step, the adapter generates two versions of a continuation — one by sampling creatively, one by always picking the most likely next note (the greedy baseline). The discriminator scores both. If the creative sample scored higher than the greedy one, reinforce those choices. If it scored lower, discourage them.

This is more nuanced than standard supervised learning (which just says "copy what's in the training data") because it allows the model to discover musical choices that are different from the training data but still musically valid. The discriminator doesn't care if the output matches the original — it cares if it sounds right.

Training alternates between three phases automatically:
1. **Warming up the critic:** The discriminator trains alone until it can reliably distinguish real from generated music.
2. **Joint training:** Both the adapter and discriminator train together, each pushing the other to improve.
3. **Focused generation:** The discriminator pauses, and the adapter trains purely on the reward signal, refining its musical output.

The system transitions between these phases automatically based on how well the discriminator is performing, ensuring neither component gets too far ahead of the other.

---

## What Goes In and Comes Out

### Input

A sequence of MIDI tokens representing a musical excerpt — typically a few bars of piano music. The tokenization captures:
- **Pitch:** Which note is played (88 piano keys)
- **Timing:** When it occurs, quantized to a beat grid (12 subdivisions per beat for fine detail, 6 for broader strokes)
- **Velocity:** How hard the note is struck (32 levels)
- **Bar boundaries:** Explicit markers that delineate musical bars

This is standard quantized MIDI — exactly what you'd find in any DAW project.

### Output

A continuation of the same token sequence, decoded back to MIDI. The output maintains bar structure, respects the established musical context, and can be any length up to the model's context window.

The generated MIDI can be played back directly, imported into a DAW, or used as a starting point for further editing.

---

## Why a Small Model?

Large language models for music exist, and they can do remarkable things. But their scale creates a barrier: training them requires institutional-level compute, large teams, and significant funding. An individual musician, researcher, or hobbyist cannot realistically train or meaningfully customize a billion-parameter model on their own hardware. They can use one through an API — but they cannot own one, shape one, or understand one end to end.

This project takes a fundamentally different approach. The entire system — decoder, adapter, discriminator, training loop — is designed to be trainable by a single person on a single consumer GPU. It is an individual-contributor-friendly architecture. You can clone this repository, download a MIDI dataset, and train the full pipeline yourself. You can inspect every weight, modify every loss function, and understand every design decision. That kind of access matters.

The decoder provides a strong foundation of musical knowledge, and the adapter — which is the only part that needs to be updated for new tasks — is deliberately compact. This means:

- **Trainable locally.** The full training pipeline runs on a single GPU. No cluster, no cloud budget, no waiting in queue. You can experiment, iterate, and train from scratch on your own machine.
- **Local inference.** Run the trained model on your own hardware, with your own data, without sending anything to the cloud.
- **Fast generation.** A small adapter means quick token generation, approaching interactive speeds.
- **Fine-tunable.** Want it to write jazz instead of classical? Retrain the adapter on jazz data. The decoder stays frozen, so you only need to update a small fraction of the total parameters.
- **Portable.** The adapter weights are small enough to share, version, and swap. Different adapters for different styles, all running on the same decoder backbone.

---

## The Adapter as a Platform

The adapter architecture is intentionally modular. The frozen decoder serves as a shared backbone — a common musical understanding — while different adapters can specialize for different tasks:

- **Style adaptation:** Train adapters on different genres, composers, or eras.
- **Instrument specialization:** While the current model focuses on piano, the architecture supports any MIDI-representable instrument.
- **Task variation:** Beyond continuation, the same architecture could support infilling (writing a middle section given start and end), harmonization, or arrangement.
- **Personal models:** Train an adapter on your own compositions to get a continuation engine that writes in your style.

Because only the adapter needs retraining, these specializations are computationally cheap — achievable on a single GPU in reasonable time.

---

## Architecture at a Glance

### Decoder

The decoder is a causal Transformer built with the x-transformers library. It uses 12 layers, 768-dimensional hidden states, 12 attention heads, and rotary positional embeddings (RoPE). Feedforward blocks use gated linear units (GLU) and flash attention is enabled for efficient computation. The context window supports sequences up to 2048 tokens. The vocabulary consists of 438 tokens covering 88 pitches, 32 velocity levels, timing tokens at two resolutions, bar boundary markers, and special tokens (BOS, EOS, PAD). The decoder is pretrained on a large MIDI corpus using standard next-token prediction and then frozen for all subsequent training.

### Adapter

The adapter receives the decoder's hidden states as input. It consists of an input projection layer (identity when dimensions match), 4 Transformer layers with the same x-transformers configuration (768-dim, 8 heads, rotary embeddings, GLU feedforward), a layer normalization, and a final linear projection to the 438-token vocabulary. All weights are initialized to near-zero so that the adapter initially behaves as a pass-through, preserving the decoder's pretrained predictions before gradually learning its own refinements. At roughly one-tenth the parameter count of the decoder, the adapter is the only component that requires gradient computation during SCST training.

### Discriminator

The discriminator is a 6-layer, 512-dimensional Transformer encoder with 8 attention heads. It takes two inputs: the prime (original musical context) and the continuation (either real or generated). The continuation is embedded and passed through the Transformer with cross-attention to the prime, allowing it to evaluate the continuation in context. Scores are produced at three granularities. A token-level head pools over individual token representations to judge note-by-note quality. A bar-level head groups tokens by bar boundary markers, computes attention-weighted bar embeddings, and scores each bar as a coherent musical phrase. An optional bar-order pathway passes bar embeddings through a separate small Transformer to evaluate whether the sequence of bars follows a musically logical progression. These scores are combined through a learned fusion layer into a single scalar output, passed through a sigmoid to produce a probability of the continuation being real. During training, the discriminator also exposes intermediate bar embeddings for a feature-matching loss that encourages the adapter to produce continuations with similar internal structure to real music.

### Generation Pipeline

At inference time, only the decoder and adapter are used. The input MIDI is tokenized into the 438-token vocabulary via MidiTok. The token sequence is fed through the frozen decoder, whose final-layer hidden states are captured via a forward hook. These hidden states are passed to the adapter, which outputs logits over the vocabulary. The next token is sampled using top-p (nucleus) sampling, constrained by a finite state machine that enforces valid token transitions (e.g., a pitch token must be followed by a velocity token). The new token is appended to the sequence, and the process repeats autoregressively until the desired continuation length is reached. The resulting token sequence is decoded back to standard MIDI.

---

## Technical Stack

- **Framework:** PyTorch
- **Transformer library:** x-transformers (rotary embeddings, flash attention, gated feedforward)
- **MIDI tokenization:** MidiTok
- **Training method:** Self-Critical Sequence Training (REINFORCE with baseline)
- **Discriminator features:** Multi-scale evaluation, bar-level pooling, optional SpanBERT features
- **Generation:** Top-p (nucleus) sampling with finite state machine constraints for valid token sequences

---

## The Visualizer

The interactive MIDI visualizer on this site lets you examine the model's output directly. For selected classical MIDI pieces, you can:

- **Play the original piece** and hear it as composed.
- **See the transition point** where the original music ends and the model's continuation begins.
- **Listen to the continuation** and judge for yourself whether it sounds coherent.
- **Compare** how the generated music relates to the original in terms of style, rhythm, and harmonic language.

This is not cherry-picked output. These are representative examples of what the model produces, presented transparently so you can form your own judgment about the quality of the continuations.

---

## Summary

Continuator is a small, local, and practical AI music tool. It takes your musical ideas and extends them — not by generating from thin air, but by understanding what you've written and writing what comes next. It is trained using reinforcement learning with a multi-scale musical critic, runs on consumer hardware, and can be fine-tuned for different styles and purposes through its modular adapter architecture.

It is built for musicians who want AI as a collaborator, not a replacement.
