/* ═══════════════════════════════════════════
   DIAGRAMS — Interactive hover/tooltip logic
   Reusable controller for both architecture
   and training loop diagrams.
   ═══════════════════════════════════════════ */

class DiagramController {
  constructor(svgSelector, infoSelector, containerSelector, config) {
    this.svg = document.querySelector(svgSelector);
    this.infoBar = document.querySelector(infoSelector);
    this.infoTitle = this.infoBar.querySelector('.diagram-info-title');
    this.infoBody = this.infoBar.querySelector('.diagram-info-body');
    this.container = document.querySelector(containerSelector);
    this.defaultText = this.infoBody.textContent;

    this.tooltips = config.tooltips;
    this.connections = config.connections;
    this.zoneMembership = config.zoneMembership;
    this.zoneBoundaryArrows = config.zoneBoundaryArrows;
    this.nestedZones = config.nestedZones || {};
    this.zoneTargets = config.zoneTargets || {};

    // Build arrow map
    this.arrowMap = {};
    this.svg.querySelectorAll('.arrow').forEach(a => {
      this.arrowMap[`${a.dataset.from}__${a.dataset.to}`] = a;
    });

    this.init();
  }

  init() {
    this.attachNodeHovers();
    this.attachZoneHovers();
  }

  clearAll() {
    this.svg.classList.remove('has-hover', 'has-zone-hover');
    this.svg.querySelectorAll('.highlight-node,.zone-member').forEach(n =>
      n.classList.remove('highlight-node', 'zone-member')
    );
    this.svg.querySelectorAll('.arrow.highlight').forEach(a => a.classList.remove('highlight'));
    this.svg.querySelectorAll('.highlight-label').forEach(l => l.classList.remove('highlight-label'));
    this.svg.querySelectorAll('.highlight-zone').forEach(z => z.classList.remove('highlight-zone'));
    this.svg.querySelectorAll('.highlight-zone-label').forEach(l => l.classList.remove('highlight-zone-label'));
    this.infoTitle.textContent = '';
    this.infoBody.textContent = this.defaultText;
    this.infoBar.classList.remove('active');
  }

  attachNodeHovers() {
    this.svg.querySelectorAll('.node').forEach(node => {
      const id = node.dataset.id;

      node.addEventListener('mouseenter', (e) => {
        e.stopPropagation();
        this.clearAll();
        this.svg.classList.add('has-hover');
        node.classList.add('highlight-node');

        const conn = this.connections[id] || { in: [], out: [] };
        const connectedNodeIds = new Set();
        [...conn.in, ...conn.out].forEach(key => {
          const arrow = this.arrowMap[key];
          if (arrow) {
            arrow.classList.add('highlight');
            arrow.querySelectorAll('.edge-label').forEach(l => l.classList.add('highlight-label'));
          }
          const parts = key.split('__');
          const otherId = parts[0] === id ? parts[1] : parts[0];
          const otherNode = this.svg.querySelector(`.node[data-id="${otherId}"]`);
          if (otherNode) {
            otherNode.classList.add('highlight-node');
            connectedNodeIds.add(otherId);
          }

          // Zone targets (arrows pointing to zone boundaries)
          if (this.zoneTargets[otherId]) {
            const z = this.svg.querySelector(`.zone-bg[data-zone="${this.zoneTargets[otherId]}"]`);
            if (z) z.classList.add('highlight-zone');
          }
        });

        // Light up zones that contain connected nodes
        for (const [zoneId, members] of Object.entries(this.zoneMembership)) {
          if (members.some(m => connectedNodeIds.has(m))) {
            const bg = this.svg.querySelector(`.zone-bg[data-zone="${zoneId}"]`);
            if (bg) bg.classList.add('highlight-zone');
          }
        }

        // Info bar
        const info = this.tooltips[id];
        if (info) {
          this.infoTitle.textContent = info.title;
          this.infoBody.textContent = info.body;
          this.infoBar.classList.add('active');
        }
      });

      node.addEventListener('mouseleave', () => this.clearAll());
    });
  }

  activateZone(zoneId) {
    this.clearAll();
    this.svg.classList.add('has-zone-hover');

    const bg = this.svg.querySelector(`.zone-bg[data-zone="${zoneId}"]`);
    if (bg) bg.classList.add('highlight-zone');
    this.svg.querySelectorAll(`.zone-label[data-zone="${zoneId}"]`).forEach(l =>
      l.classList.add('highlight-zone-label')
    );

    // Nested zones
    (this.nestedZones[zoneId] || []).forEach(nz => {
      const nb = this.svg.querySelector(`.zone-bg[data-zone="${nz}"]`);
      if (nb) nb.classList.add('highlight-zone');
      this.svg.querySelectorAll(`.zone-label[data-zone="${nz}"]`).forEach(l =>
        l.classList.add('highlight-zone-label')
      );
    });

    // Member nodes
    (this.zoneMembership[zoneId] || []).forEach(nid => {
      const n = this.svg.querySelector(`.node[data-id="${nid}"]`);
      if (n) n.classList.add('zone-member');
    });

    // Boundary arrows
    (this.zoneBoundaryArrows[zoneId] || []).forEach(key => {
      const a = this.arrowMap[key];
      if (a) {
        a.classList.add('highlight');
        a.querySelectorAll('.edge-label').forEach(l => l.classList.add('highlight-label'));
      }
    });
  }

  attachZoneHovers() {
    // Zone hovers disabled — zones light up via node hover instead
  }
}

/* ═══════════════════════════════════════════
   Architecture Diagram Configuration
   ═══════════════════════════════════════════ */

const archConfig = {
  tooltips: {
    'prime-seq':       { title: 'Prime Sequence', body: 'The input context fed to the decoder. During generation, sampled tokens are appended back here in an autoregressive loop.' },
    'dec-transformer': { title: 'Decoder Transformer', body: 'The main autoregressive transformer that processes the prime sequence. Frozen during SCST generation \u2014 only the adapter is trained.' },
    'last-hiddens':    { title: 'Last Layer Hiddens', body: "Hidden state output from the transformer's final layer. Feeds both the logit head (for pre-training) and the adapter (during generation)." },
    'logits':          { title: 'Logits', body: "Raw unnormalized scores over the vocabulary, produced by the decoder's language model head from the last-layer hiddens." },
    'next-token':      { title: 'Next-Token Prediction', body: 'Standard autoregressive language modeling loss (cross-entropy). The primary pre-training objective.' },
    'pf-lite':         { title: 'PF-lite', body: "A lightweight \"prefix-free\" auxiliary loss used during pre-training to improve the model's structured generation capabilities." },
    'contrastive-bar': { title: 'Contrastive Bar Loss', body: 'Contrastive loss at the bar level that teaches the model to distinguish coherent musical bars from shuffled ones during pre-training.' },
    'input-proj':      { title: 'Input Projection', body: "Projects the frozen decoder's hidden states into the adapter's input space. First layer of the trainable adapter." },
    'adp-transformer': { title: 'Adapter Transformer', body: "A smaller transformer within the adapter that refines the frozen decoder's representations. Initialized to identity so it starts as a pass-through." },
    'to-logits':       { title: 'To Logits', body: "Projects the adapter's output back to vocabulary logits. These adapted logits are what get sampled during SCST generation." },
    'fsm':             { title: 'Finite-State Machine', body: 'Constrains the sampling to only produce structurally valid token sequences by masking out illegal transitions at each step.' },
    'top-p':           { title: 'Top-p Sampling', body: 'Nucleus sampling that selects from the smallest set of tokens whose cumulative probability exceeds p, providing controlled diversity.' },
    'batch-prime':     { title: 'Batch: Prime Sequence', body: 'The context/prompt portion of each training example in the batch.' },
    'batch-gen':       { title: 'Batch: Generated Continuation', body: "The model's own generated continuation (from the generation loop), used as the 'fake' input to the discriminator." },
    'batch-real':      { title: 'Batch: Real Continuation', body: "Ground-truth continuation from the training data, used as the 'real' input to the discriminator." },
    'batch-mismatch':  { title: 'Batch: Real Mismatched', body: "A real continuation paired with a different prime, serving as a hard negative for the discriminator's conditional reasoning." },
    'encoder':         { title: 'Discriminator Encoder', body: 'Encodes both the prime context and the continuation into shared representations for the cross-attention mechanism.' },
    'cross-attn':      { title: 'Cross-Attention', body: 'Attends between the prime context encoding and the continuation embedding, enabling the discriminator to reason about coherence.' },
    'bar-head':        { title: 'Bar-Level Head', body: 'Produces per-bar discrimination scores, assessing quality at a structural level (musical bars / phrase segments).' },
    'token-head':      { title: 'Token Head', body: 'Produces per-token discrimination scores, providing fine-grained quality assessment at the individual token level.' },
    'global-pool':     { title: 'Global Pooling', body: 'Aggregates bar-level scores into a single global representation via pooling (e.g. mean or attention pooling).' },
    'mean-token':      { title: 'Mean Token Score', body: 'Averages the per-token scores into a single scalar, providing a token-level quality summary.' },
    'global-score':    { title: 'Global Score', body: 'Final discrimination output combining bar-level and token-level signals. This scalar is the reward signal used in SCST training.' }
  },
  connections: {
    'prime-seq':       { out: ['prime-seq__dec-transformer', 'prime-seq__batch-zone'], in: ['top-p__prime-seq'] },
    'dec-transformer': { out: ['dec-transformer__last-hiddens'], in: ['prime-seq__dec-transformer', 'pretrain-losses-zone__dec-transformer'] },
    'last-hiddens':    { out: ['last-hiddens__logits', 'last-hiddens__input-proj'], in: ['dec-transformer__last-hiddens'] },
    'logits':          { out: ['logits__pretrain-losses-zone'], in: ['last-hiddens__logits'] },
    'next-token':      { out: [], in: [] },
    'pf-lite':         { out: [], in: [] },
    'contrastive-bar': { out: [], in: [] },
    'input-proj':      { out: ['input-proj__adp-transformer'], in: ['last-hiddens__input-proj'] },
    'adp-transformer': { out: ['adp-transformer__to-logits'], in: ['input-proj__adp-transformer'] },
    'to-logits':       { out: ['to-logits__sampler-zone'], in: ['adp-transformer__to-logits'] },
    'fsm':             { out: ['fsm__top-p'], in: [] },
    'top-p':           { out: ['top-p__prime-seq'], in: ['fsm__top-p'] },
    'batch-prime':     { out: [], in: [] },
    'batch-gen':       { out: [], in: [] },
    'batch-real':      { out: [], in: [] },
    'batch-mismatch':  { out: [], in: [] },
    'encoder':         { out: ['encoder__cross-attn', 'encoder__cross-attn-bot'], in: [] },
    'cross-attn':      { out: ['cross-attn__bar-head', 'cross-attn__token-head'], in: ['encoder__cross-attn', 'encoder__cross-attn-bot'] },
    'bar-head':        { out: ['bar-head__global-pool'], in: ['cross-attn__bar-head'] },
    'token-head':      { out: ['token-head__mean-token'], in: ['cross-attn__token-head'] },
    'global-pool':     { out: ['global-pool__global-score'], in: ['bar-head__global-pool'] },
    'mean-token':      { out: ['mean-token__global-score'], in: ['token-head__mean-token'] },
    'global-score':    { out: [], in: ['global-pool__global-score', 'mean-token__global-score'] }
  },
  zoneMembership: {
    'generation':      ['prime-seq', 'dec-transformer', 'last-hiddens', 'logits', 'next-token', 'pf-lite', 'contrastive-bar', 'input-proj', 'adp-transformer', 'to-logits', 'fsm', 'top-p'],
    'decoder':         ['dec-transformer', 'last-hiddens', 'logits', 'next-token', 'pf-lite', 'contrastive-bar'],
    'pretrain-losses': ['next-token', 'pf-lite', 'contrastive-bar'],
    'adapter':         ['input-proj', 'adp-transformer', 'to-logits'],
    'sampler':         ['fsm', 'top-p'],
    'batch':           ['batch-prime', 'batch-gen', 'batch-real', 'batch-mismatch'],
    'discriminator':   ['encoder', 'cross-attn', 'bar-head', 'token-head', 'global-pool', 'mean-token', 'global-score'],
    'disc-encoder':    ['encoder', 'cross-attn']
  },
  zoneBoundaryArrows: {
    'generation':      ['top-p__prime-seq', 'prime-seq__dec-transformer', 'last-hiddens__input-proj', 'to-logits__sampler-zone', 'prime-seq__batch-zone'],
    'decoder':         ['prime-seq__dec-transformer', 'dec-transformer__last-hiddens', 'last-hiddens__logits', 'logits__pretrain-losses-zone', 'pretrain-losses-zone__dec-transformer', 'last-hiddens__input-proj'],
    'pretrain-losses': ['logits__pretrain-losses-zone', 'pretrain-losses-zone__dec-transformer'],
    'adapter':         ['last-hiddens__input-proj', 'input-proj__adp-transformer', 'adp-transformer__to-logits', 'to-logits__sampler-zone'],
    'sampler':         ['to-logits__sampler-zone', 'fsm__top-p', 'top-p__prime-seq'],
    'batch':           ['prime-seq__batch-zone', 'batch-zone__discriminator-zone'],
    'discriminator':   ['batch-zone__discriminator-zone', 'encoder__cross-attn', 'encoder__cross-attn-bot', 'cross-attn__bar-head', 'cross-attn__token-head', 'bar-head__global-pool', 'token-head__mean-token', 'global-pool__global-score', 'mean-token__global-score'],
    'disc-encoder':    ['encoder__cross-attn', 'encoder__cross-attn-bot', 'cross-attn__bar-head', 'cross-attn__token-head']
  },
  nestedZones: {
    'generation': ['decoder', 'pretrain-losses', 'adapter', 'sampler'],
    'decoder': ['pretrain-losses'],
    'discriminator': ['disc-encoder']
  },
  zoneTargets: {
    'pretrain-losses-zone': 'pretrain-losses',
    'sampler-zone': 'sampler',
    'batch-zone': 'batch',
    'discriminator-zone': 'discriminator'
  }
};

/* ═══════════════════════════════════════════
   SCST Training Loop Configuration
   ═══════════════════════════════════════════ */

const scstConfig = {
  tooltips: {
    'prepare-batch':   { title: 'Prepare Batch', body: 'Samples a batch of input sequences from the training data, preparing context tokens for the generation and discrimination pipeline.' },
    'phase-decision':  { title: 'Phase Decision', body: 'Routes training based on discriminator quality. "Disc weak" \u2192 warm-up phase, "Disc okay" \u2192 refresh phase, "Disc strong" \u2192 RL-only phase.' },
    'warmup':          { title: 'Warm-up Phase', body: 'Initial phase where the discriminator is trained on real vs fake sequences to build classification ability before RL training begins.' },
    'refresh':         { title: 'Refresh Phase', body: 'Mixed phase that simultaneously updates both the discriminator and the generator via RL, keeping the discriminator calibrated.' },
    'rl-only':         { title: 'RL-only Phase', body: "Pure reinforcement learning phase where only the generator is updated using the frozen discriminator's reward signal." },
    'real-seq':        { title: "'Real' Sequence", body: "Ground-truth sequence from the training data, used as the positive example for the discriminator's binary classification objective." },
    'fake-seq':        { title: "'Fake' Sequence", body: 'Generated sequence from the model (via greedy decoding), used as the negative example for discriminator training. Detached from the computation graph.' },
    'loss-comp':       { title: 'Loss Computation', body: "Computes the discriminator's binary cross-entropy loss between real and fake sequences." },
    'opt-real-seq':    { title: "Optional 'Real' Sequence", body: 'Additional real sequence optionally fed into the discriminator during its update step for improved training stability.' },
    'mismatch-seq':    { title: "Mismatched 'Real' Sequence", body: "A real sequence paired with a different context, serving as a hard negative to improve the discriminator's conditional reasoning." },
    'greedy-hiddens':  { title: 'Greedy Hiddens', body: "Hidden states from the frozen decoder's greedy (argmax) forward pass. Serves as the baseline for the SCST reward computation." },
    'sampled-hiddens': { title: 'Sampled Hiddens', body: "Hidden states from the frozen decoder's sampled forward pass. These flow through the trainable adapter and are used for the RL policy gradient." },
    'greedy-cont':     { title: 'Greedy Continuation', body: 'Adapter output for the greedy-decoded baseline. Used to compute the baseline reward in the SCST self-critical objective.' },
    'sampled-cont':    { title: 'Sampled Continuation', body: "Adapter output for the sampled sequence. The RL loss is computed by comparing this sample's reward against the greedy baseline." },
    'rl-loss':         { title: 'RL Loss', body: 'The REINFORCE loss weighted by advantage (sampled reward \u2212 greedy baseline reward). This is the core SCST gradient signal for the adapter.' },
    'feature-match':   { title: 'Feature Match Loss', body: "Regularization loss that encourages the generator's intermediate features to match statistics of real data, stabilizing GAN-style training." },
    'policy-entropy':  { title: 'Policy Entropy', body: 'Entropy bonus encouraging exploration by penalizing overly peaked output distributions.' },
    'teacher-forced':  { title: 'Teacher-Forced Loss', body: 'Standard MLE loss on ground-truth tokens, acting as a regularizer to prevent the RL policy from drifting too far from the pretrained model.' },
    'kl-reg':          { title: 'KL Policy Regularization', body: 'KL divergence penalty between the current policy and a reference policy, constraining how far the adapter can deviate from the base model.' },
    'param-updates':   { title: 'Parameter Updates', body: 'Aggregates all loss signals (RL + regularization + optional discriminator) and applies gradient updates to the trainable adapter parameters.' }
  },
  connections: {
    'prepare-batch':   { out: ['prepare-batch__phase-decision'], in: ['param-updates__prepare-batch'] },
    'phase-decision':  { out: ['phase-decision__warmup', 'phase-decision__refresh', 'phase-decision__rl-only'], in: ['prepare-batch__phase-decision'] },
    'warmup':          { out: ['warmup__discriminator-zone'], in: ['phase-decision__warmup'] },
    'refresh':         { out: ['refresh__discriminator-zone', 'refresh__decoder-zone'], in: ['phase-decision__refresh'] },
    'rl-only':         { out: ['rl-only__decoder-zone'], in: ['phase-decision__rl-only'] },
    'real-seq':        { out: ['real-seq__loss-comp'], in: [] },
    'fake-seq':        { out: ['fake-seq__loss-comp'], in: ['greedy-cont__fake-seq'] },
    'loss-comp':       { out: ['loss-comp__feature-match', 'loss-comp__opt-real-seq', 'rl-loss-to-param__param-updates'], in: ['real-seq__loss-comp', 'fake-seq__loss-comp'] },
    'greedy-hiddens':  { out: ['greedy-hiddens__greedy-cont'], in: [] },
    'sampled-hiddens': { out: ['sampled-hiddens__sampled-cont'], in: [] },
    'greedy-cont':     { out: ['greedy-cont__rl-loss', 'greedy-cont__fake-seq'], in: ['greedy-hiddens__greedy-cont'] },
    'sampled-cont':    { out: ['sampled-cont__rl-loss', 'sampled-cont__regloss-zone'], in: ['sampled-hiddens__sampled-cont'] },
    'rl-loss':         { out: ['rl-loss-to-param__param-updates'], in: ['greedy-cont__rl-loss', 'sampled-cont__rl-loss', 'discriminator-zone__rl-loss'] },
    'feature-match':   { out: [], in: ['loss-comp__feature-match'] },
    'policy-entropy':  { out: [], in: [] },
    'teacher-forced':  { out: [], in: [] },
    'kl-reg':          { out: [], in: [] },
    'opt-real-seq':    { out: [], in: ['loss-comp__opt-real-seq'] },
    'mismatch-seq':    { out: [], in: [] },
    'param-updates':   { out: ['param-updates__prepare-batch'], in: ['rl-loss-to-param__param-updates', 'param-updates__reg-losses'] }
  },
  zoneMembership: {
    'phase':         ['warmup', 'refresh', 'rl-only'],
    'decoder':       ['greedy-hiddens', 'sampled-hiddens'],
    'generation':    ['greedy-hiddens', 'sampled-hiddens', 'greedy-cont', 'sampled-cont'],
    'adapter':       ['greedy-cont', 'sampled-cont', 'rl-loss', 'feature-match', 'policy-entropy', 'teacher-forced', 'kl-reg'],
    'discriminator': ['real-seq', 'fake-seq', 'loss-comp', 'opt-real-seq', 'mismatch-seq'],
    'optional':      ['opt-real-seq', 'mismatch-seq'],
    'regloss':       ['feature-match', 'policy-entropy', 'teacher-forced', 'kl-reg']
  },
  zoneBoundaryArrows: {
    'phase':         ['prepare-batch__phase-decision', 'phase-decision__warmup', 'phase-decision__refresh', 'phase-decision__rl-only',
                      'warmup__discriminator-zone', 'refresh__discriminator-zone', 'refresh__decoder-zone', 'rl-only__decoder-zone'],
    'decoder':       ['refresh__decoder-zone', 'rl-only__decoder-zone', 'greedy-hiddens__greedy-cont', 'sampled-hiddens__sampled-cont'],
    'generation':    ['refresh__decoder-zone', 'rl-only__decoder-zone', 'greedy-hiddens__greedy-cont', 'sampled-hiddens__sampled-cont',
                      'greedy-cont__rl-loss', 'sampled-cont__rl-loss', 'greedy-cont__fake-seq', 'sampled-cont__regloss-zone'],
    'adapter':       ['greedy-hiddens__greedy-cont', 'sampled-hiddens__sampled-cont', 'greedy-cont__rl-loss', 'sampled-cont__rl-loss',
                      'greedy-cont__fake-seq', 'sampled-cont__regloss-zone', 'discriminator-zone__rl-loss',
                      'rl-loss-to-param__param-updates', 'loss-comp__feature-match'],
    'discriminator': ['warmup__discriminator-zone', 'refresh__discriminator-zone', 'real-seq__loss-comp', 'fake-seq__loss-comp',
                      'greedy-cont__fake-seq', 'discriminator-zone__rl-loss', 'loss-comp__feature-match', 'loss-comp__opt-real-seq',
                      'rl-loss-to-param__param-updates'],
    'optional':      ['loss-comp__opt-real-seq'],
    'regloss':       ['loss-comp__feature-match', 'sampled-cont__regloss-zone']
  },
  nestedZones: {
    'generation': ['decoder'],
    'adapter': ['regloss'],
    'discriminator': ['optional']
  },
  zoneTargets: {
    'discriminator-zone': 'discriminator',
    'decoder-zone': 'decoder',
    'regloss-zone': 'regloss'
  }
};

/* ═══════════════════════════════════════════
   Tab switching
   ═══════════════════════════════════════════ */

function initDiagrams() {
  // Initialize controllers
  const archCtrl = new DiagramController('#arch-svg', '#arch-info', '#arch-container', archConfig);
  const scstCtrl = new DiagramController('#scst-svg', '#scst-info', '#scst-container', scstConfig);

  // Tab switching
  document.querySelectorAll('.diagram-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.diagram;

      document.querySelectorAll('.diagram-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      document.querySelectorAll('.diagram-panel').forEach(p => p.classList.remove('active'));
      const panel = document.getElementById(`panel-${target}`);
      if (panel) panel.classList.add('active');

      // Clear any active hovers
      archCtrl.clearAll();
      scstCtrl.clearAll();
    });
  });
}
