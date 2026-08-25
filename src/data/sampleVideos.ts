import { VideoItem } from '../types';

export const INITIAL_VIDEOS: VideoItem[] = [
  {
    id: 'vid-gemini-multimodal',
    title: 'Gemini 3 Architecture: Multimodal Reasoning & Video Intelligence',
    description: 'A comprehensive technical breakdown of native multimodal video understanding, dynamic token compression, temporal video grounding, and long-context cross-modal attention mechanisms.',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    streamType: 'mp4',
    duration: 596,
    thumbnail: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
    author: 'DeepMind Research Lab',
    authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
    publishedAt: '2026-08-15',
    views: 142850,
    likes: 9840,
    category: 'AI & Machine Learning',
    tags: ['Gemini', 'Multimodal', 'Video AI', 'Computer Vision', 'Deep Learning'],
    chapters: [
      {
        id: 'c1',
        startTime: 0,
        endTime: 95,
        title: '01. Executive Overview & Cross-Modal Encoders',
        summary: 'Introduction to spatial-temporal patch embedding and frame sampling strategies.',
        keyVisual: 'Neural network layer visualization',
        confidence: 0.98
      },
      {
        id: 'c2',
        startTime: 95,
        endTime: 210,
        title: '02. Temporal Attention & Keyframe Discretization',
        summary: 'How dense video frames are quantized into continuous semantic vectors.',
        keyVisual: 'Attention matrix across time axes',
        confidence: 0.95
      },
      {
        id: 'c3',
        startTime: 210,
        endTime: 380,
        title: '03. Zero-Shot Visual Grounding & Object Tracking',
        summary: 'Fine-grained bounding box regression combined with natural language queries.',
        keyVisual: 'Bounding boxes tracking moving objects in dynamic scenes',
        confidence: 0.97
      },
      {
        id: 'c4',
        startTime: 380,
        endTime: 510,
        title: '04. Real-Time Video Streaming Inference Pipeline',
        summary: 'KV cache compression and low-latency chunked streaming inference architecture.',
        keyVisual: 'Streaming throughput and memory benchmarks',
        confidence: 0.96
      },
      {
        id: 'c5',
        startTime: 510,
        endTime: 596,
        title: '05. Future Horizons: Native 3D Spatial Video Agents',
        summary: 'Roadmap for real-world robotics embodiment and spatial compute integration.',
        keyVisual: '3D point cloud reconstruction demo',
        confidence: 0.94
      }
    ],
    transcript: [
      { id: 't1', startTime: 0, endTime: 18, speaker: 'Dr. Evelyn Vance', text: 'Welcome everyone. Today we are unpacking the revolutionary architectural primitives powering the Gemini 3 multimodal video engine.' },
      { id: 't2', startTime: 19, endTime: 48, speaker: 'Dr. Evelyn Vance', text: 'Unlike previous generation systems that treated video as a sequence of isolated image frames, Gemini 3 processes continuous temporal tensors directly in latent space.' },
      { id: 't3', startTime: 49, endTime: 94, speaker: 'Dr. Evelyn Vance', text: 'This enables zero-latency video understanding, action recognition, and sub-second timestamp localization across hours of unedited raw footage.' },
      { id: 't4', startTime: 95, endTime: 145, speaker: 'Dr. Marcus Chen', text: 'Let us examine the frame discretizer. Notice how adaptive frame rate subsampling adjusts dynamically during high-motion action scenes.' },
      { id: 't5', startTime: 146, endTime: 209, speaker: 'Dr. Marcus Chen', text: 'When visual entropy is low, compute is conserved. When rapid micro-events occur, the model scales sampling resolution to 60fps equivalent temporal precision.' },
      { id: 't6', startTime: 210, endTime: 290, speaker: 'Dr. Evelyn Vance', text: 'In our grounded Q&A benchmarks, the reasoning agent identifies specific object states at millisecond timestamps with over 98.4% precision.' },
      { id: 't7', startTime: 291, endTime: 379, speaker: 'Dr. Evelyn Vance', text: 'This allows developers to index petabytes of enterprise media, live security streams, and sports analytics on the fly.' },
      { id: 't8', startTime: 380, endTime: 440, speaker: 'Dr. Marcus Chen', text: 'On the streaming pipeline side, we utilize chunked attention with progressive KV-cache compaction to sustain 4K 60fps throughput.' },
      { id: 't9', startTime: 441, endTime: 509, speaker: 'Dr. Marcus Chen', text: 'This reduces memory footprint by 74% compared to standard dense transformers without degrading perplexity.' },
      { id: 't10', startTime: 510, endTime: 596, speaker: 'Dr. Evelyn Vance', text: 'Thank you for exploring this architecture. Next up, we will demonstrate live interactive video indexing and grounded chat.' }
    ],
    keyTakeaways: [
      'Native temporal tensor processing outperforms isolated keyframe OCR and frame slicing.',
      'Adaptive entropy-based frame rate scaling cuts compute by up to 60% while maintaining temporal fidelity.',
      'Fine-grained temporal grounding delivers millisecond-precision timestamp citations in Q&A.',
      'KV-cache compression enables continuous, real-time live streaming inference at scale.'
    ],
    topicAffinities: [
      { topic: 'AI & Machine Learning', weight: 0.98 },
      { topic: 'Computer Vision', weight: 0.92 },
      { topic: 'Video Streaming', weight: 0.88 },
      { topic: 'Deep Learning', weight: 0.85 }
    ],
    visualScenes: [
      { timestamp: 12, sceneDescription: 'High-tech neural schematic demonstrating cross-modal projection layers', objects: ['diagram', 'neural layers', 'matrices'], sentiment: 'Technical' },
      { timestamp: 110, sceneDescription: 'Dynamic waveform and frame entropy graph showing adaptive subsampling', objects: ['graph', 'entropy curve', 'timeline'], sentiment: 'Analytical' },
      { timestamp: 245, sceneDescription: 'Multi-camera split view tracking moving autonomous vehicles and pedestrian bounding boxes', objects: ['cars', 'pedestrians', 'bounding boxes'], sentiment: 'Dynamic' },
      { timestamp: 415, sceneDescription: 'Hardware acceleration bench showcasing TPU v5e memory bandwidth', objects: ['TPU chip', 'bandwidth chart'], sentiment: 'Empirical' }
    ],
    aiGeneratedClips: [
      { id: 'clip-1', startTime: 19, endTime: 48, title: 'How Gemini 3 Processes Video As Continuous Tensors', hook: 'Stop slicing frames into JPEG stills—here is how modern video AI actually works.', viralityScore: 94 },
      { id: 'clip-2', startTime: 95, endTime: 145, title: 'Adaptive Frame Sampling: 60fps Precision on a Budget', hook: 'Why low entropy scenes save 60% compute instantly.', viralityScore: 89 },
      { id: 'clip-3', startTime: 380, endTime: 440, title: '4K Streaming Video Inference at Scale', hook: 'The KV-cache trick that unlocked real-time AI video search.', viralityScore: 96 }
    ],
    specs: {
      resolution: '3840x2160 (4K UHD)',
      codec: 'H.265 / HEVC',
      bitrate: '18.4 Mbps',
      aspectRatio: '16:9'
    }
  },
  {
    id: 'vid-quantum-supremacy',
    title: 'Quantum Neural Networks: Topological Qubits & Error Mitigation',
    description: 'Exploring fault-tolerant quantum algorithms, Majorana zero modes, and variational quantum eigensolvers for next-generation cryptographic resilience.',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    streamType: 'mp4',
    duration: 653,
    thumbnail: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=1200&q=80',
    author: 'Quantum Nexus Institute',
    authorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80',
    publishedAt: '2026-08-10',
    views: 89400,
    likes: 6420,
    category: 'Quantum Computing',
    tags: ['Quantum', 'Physics', 'Qubits', 'Supercomputing', 'Cryptography'],
    chapters: [
      { id: 'cq1', startTime: 0, endTime: 120, title: '01. Fundamentals of Topological Decoherence', summary: 'Why noise remains the primary bottleneck for NISQ devices.', confidence: 0.96 },
      { id: 'cq2', startTime: 120, endTime: 270, title: '02. Majorana Braiding & Surface Code Arrays', summary: 'Braiding non-Abelian anyons to achieve hardware-level fault tolerance.', confidence: 0.94 },
      { id: 'cq3', startTime: 270, endTime: 450, title: '03. Hybrid Quantum-Classical Optimization', summary: 'Executing VQE on superconducting transmon processors.', confidence: 0.97 },
      { id: 'cq4', startTime: 450, endTime: 653, title: '04. Cryptographic Post-Quantum Transition', summary: 'Lattice-based encryption and quantum key distribution testbeds.', confidence: 0.95 }
    ],
    transcript: [
      { id: 'tq1', startTime: 0, endTime: 35, speaker: 'Prof. Alexei Rostov', text: 'Topological quantum computing represents a paradigm shift in how we protect quantum states from environmental decoherence.' },
      { id: 'tq2', startTime: 36, endTime: 119, speaker: 'Prof. Alexei Rostov', text: 'By encoding information non-locally in pairs of Majorana zero modes, localized thermal noise cannot corrupt the qubit state.' },
      { id: 'tq3', startTime: 120, endTime: 269, speaker: 'Dr. Elena Zhang', text: 'When we braid these anyons across a 2D nanowire lattice, quantum gates are implemented purely through geometric topology.' },
      { id: 'tq4', startTime: 270, endTime: 449, speaker: 'Dr. Elena Zhang', text: 'This enables physical gate fidelities exceeding 99.99%, crossing the critical threshold for fault-tolerant surface code correction.' }
    ],
    keyTakeaways: [
      'Topological protection encodes qubits non-locally, shielding against ambient thermal phase shifts.',
      'Surface code lattices require gate fidelities >99.9% to achieve net error suppression.',
      'Hybrid quantum-classical algorithms solve complex molecular simulation problems.'
    ],
    topicAffinities: [
      { topic: 'Quantum Computing', weight: 0.99 },
      { topic: 'Physics', weight: 0.89 },
      { topic: 'Cryptography', weight: 0.84 }
    ],
    specs: {
      resolution: '1920x1080 (FHD)',
      codec: 'H.264 / AVC',
      bitrate: '9.2 Mbps',
      aspectRatio: '16:9'
    }
  },
  {
    id: 'vid-cybernetic-robotics',
    title: 'Autonomous Humanoid Robotics: End-to-End Vision-Language-Action Models',
    description: 'How high-frequency physical simulation, reinforcement learning from human feedback, and real-time spatial actuation power next-gen humanoid dexterity.',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    streamType: 'mp4',
    duration: 480,
    thumbnail: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=1200&q=80',
    author: 'CyberMotion Dynamics',
    authorAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&q=80',
    publishedAt: '2026-08-01',
    views: 312000,
    likes: 21500,
    category: 'Robotics & Automation',
    tags: ['Robotics', 'Humanoid', 'VLA Models', 'Actuation', 'Reinforcement Learning'],
    chapters: [
      { id: 'cr1', startTime: 0, endTime: 110, title: '01. High-Torque Brushless Actuators & Tendon Routing', summary: 'Mechanical design for human-equivalent compliance and strength.', confidence: 0.97 },
      { id: 'cr2', startTime: 110, endTime: 260, title: '02. VLA Transformers for Dexterous Manipulation', summary: 'Predicting 6-DoF end-effector trajectories directly from RGB-D streams.', confidence: 0.96 },
      { id: 'cr3', startTime: 260, endTime: 480, title: '03. Whole-Body Dynamic Balance & Parkour Benchmarks', summary: 'Zero-shot sim-to-real transfer over uneven terrain.', confidence: 0.98 }
    ],
    transcript: [
      { id: 'tr1', startTime: 0, endTime: 40, speaker: 'Sora Tanaka', text: 'Humanoid robotics has reached an inflection point where vision, natural language, and low-level torque commands operate in a unified policy.' },
      { id: 'tr2', startTime: 41, endTime: 109, speaker: 'Sora Tanaka', text: 'Our custom quasi-direct drive actuators deliver over 180 Nm peak torque with sub-millisecond response latency.' },
      { id: 'tr3', startTime: 110, endTime: 259, speaker: 'Kai Williams', text: 'By training on 100,000 hours of teleoperated physical tasks in photorealistic simulation, the humanoid generalizes to unseen household tools.' }
    ],
    keyTakeaways: [
      'Vision-Language-Action (VLA) models unify perception, planning, and control into a single end-to-end network.',
      'Quasi-direct drive motors provide high backdrivability and gentle contact compliance.',
      'Massive parallel simulation enables rapid zero-shot sim-to-real locomotion policies.'
    ],
    topicAffinities: [
      { topic: 'Robotics & Automation', weight: 0.98 },
      { topic: 'AI & Machine Learning', weight: 0.91 },
      { topic: 'Computer Vision', weight: 0.86 }
    ],
    specs: {
      resolution: '1920x1080 (FHD)',
      codec: 'H.264 / AVC',
      bitrate: '12.0 Mbps',
      aspectRatio: '16:9'
    }
  },
  {
    id: 'vid-deep-space-astronomy',
    title: 'Deep Space Spectroscopy: Detecting Exoplanet Biosignatures in Trappist-1',
    description: 'Infrared transmission spectra analysis detecting atmospheric ozone, methane disequilibria, and ocean glint signatures on terrestrial worlds.',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    streamType: 'mp4',
    duration: 734,
    thumbnail: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80',
    author: 'Astrophysical Discovery Network',
    authorAvatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=120&q=80',
    publishedAt: '2026-07-28',
    views: 205000,
    likes: 15400,
    category: 'Space & Astronomy',
    tags: ['Space', 'Exoplanets', 'Spectroscopy', 'James Webb', 'Astrobiology'],
    chapters: [
      { id: 'cs1', startTime: 0, endTime: 150, title: '01. Transit Spectroscopy & Atmospheric Filtering', summary: 'How starlight passing through planet atmospheres reveals molecular absorption lines.', confidence: 0.98 },
      { id: 'cs2', startTime: 150, endTime: 340, title: '02. The Chemical Biosignature Pair: Methane and Ozone', summary: 'Thermodynamic disequilibrium as a high-confidence biomarker.', confidence: 0.95 },
      { id: 'cs3', startTime: 340, endTime: 520, title: '03. Direct Imaging Coronagraphs & Polarization Glint', summary: 'Suppressing stellar glare by 10 orders of magnitude to image surface oceans.', confidence: 0.93 },
      { id: 'cs4', startTime: 520, endTime: 734, title: '04. Next-Gen 30-Meter Ground Observatories', summary: 'Adaptive optics arrays compensating for atmospheric atmospheric turbulence.', confidence: 0.96 }
    ],
    transcript: [
      { id: 'ts1', startTime: 0, endTime: 45, speaker: 'Dr. Arthur Sterling', text: 'When Trappist-1e transits its host red dwarf star, just a fraction of starlight filters through the planet atmosphere.' },
      { id: 'ts2', startTime: 46, endTime: 149, speaker: 'Dr. Arthur Sterling', text: 'By subtracting out stellar spectral flares using high-contrast algorithms, we isolate the distinct infrared fingerprints of carbon dioxide, water vapor, and methane.' }
    ],
    keyTakeaways: [
      'Atmospheric transmission spectroscopy isolates molecular absorption peaks down to parts-per-million sensitivity.',
      'Simultaneous detection of methane and oxygen/ozone strongly indicates active non-equilibrium biological replenishing.',
      'Coronagraphic polarization filters enable direct reflection detection of liquid water oceans.'
    ],
    topicAffinities: [
      { topic: 'Space & Astronomy', weight: 0.99 },
      { topic: 'Physics', weight: 0.85 },
      { topic: 'Exoplanets', weight: 0.92 }
    ],
    specs: {
      resolution: '3840x2160 (4K UHD)',
      codec: 'H.265 / HEVC',
      bitrate: '22.1 Mbps',
      aspectRatio: '16:9'
    }
  },
  {
    id: 'vid-synthetic-biology',
    title: 'CRISPR 3.0 & Generative Protein Folding: Precision Gene Therapy',
    description: 'Diffusion-based de novo protein design, prime editing without double-strand breaks, and targeted lipid nanoparticle in vivo delivery.',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
    streamType: 'mp4',
    duration: 520,
    thumbnail: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=1200&q=80',
    author: 'BioGenesis Labs',
    authorAvatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=120&q=80',
    publishedAt: '2026-07-15',
    views: 118000,
    likes: 8200,
    category: 'Biotech & Genomics',
    tags: ['CRISPR', 'Synthetic Biology', 'Protein Design', 'Gene Editing', 'Nanomedicine'],
    chapters: [
      { id: 'cb1', startTime: 0, endTime: 130, title: '01. Generative Diffusion Models for Protein Therapeutics', summary: 'Generating novel enzyme backbones tailored for specific catalytic active sites.', confidence: 0.97 },
      { id: 'cb2', startTime: 130, endTime: 310, title: '02. Prime Editing & Epigenetic Switching', summary: 'Writing custom nucleotide insertions without inducing double-strand DNA damage.', confidence: 0.96 },
      { id: 'cb3', startTime: 310, endTime: 520, title: '03. Cell-Specific Lipid Nanoparticle Targeting', summary: 'Targeting specific tissue receptors for tissue-directed in vivo mRNA delivery.', confidence: 0.94 }
    ],
    transcript: [
      { id: 'tb1', startTime: 0, endTime: 38, speaker: 'Dr. Priya Nair', text: 'Generative AI has transformed molecular biology from an empirical discovery science into an exact engineering discipline.' },
      { id: 'tb2', startTime: 39, endTime: 129, speaker: 'Dr. Priya Nair', text: 'Using 3D diffusion architectures, we can specify an arbitrary binding pocket and generate a de novo protein that folds with sub-angstrom accuracy.' }
    ],
    keyTakeaways: [
      'De novo protein diffusion creates custom synthetic enzymes with atomic precision.',
      'Prime editing enables point mutation corrections without harmful double-strand breaks.',
      'Targeted lipid nanoparticles ensure zero off-target tissue accumulation in vivo.'
    ],
    topicAffinities: [
      { topic: 'Biotech & Genomics', weight: 0.98 },
      { topic: 'AI & Machine Learning', weight: 0.88 },
      { topic: 'Nanomedicine', weight: 0.82 }
    ],
    specs: {
      resolution: '1920x1080 (FHD)',
      codec: 'H.264 / AVC',
      bitrate: '10.5 Mbps',
      aspectRatio: '16:9'
    }
  },
  {
    id: 'vid-cybersecurity-zero-trust',
    title: 'Post-Quantum Zero Trust Architecture & Autonomous Cyber Defense',
    description: 'Continuous cryptographic micro-segmentation, AI-driven behavioral anomaly detection, and automated honeypot deception fabrics in enterprise clouds.',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WhatCarCanYouGetForAGrand.mp4',
    streamType: 'mp4',
    duration: 410,
    thumbnail: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1200&q=80',
    author: 'Aegis Cyber Defense',
    authorAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80',
    publishedAt: '2026-07-02',
    views: 97500,
    likes: 5120,
    category: 'Cybersecurity & Cloud',
    tags: ['Cybersecurity', 'Zero Trust', 'Post Quantum', 'Cloud Infrastructure', 'Network Security'],
    chapters: [
      { id: 'cc1', startTime: 0, endTime: 100, title: '01. The Death of the Network Perimeter', summary: 'Why identity and contextual session risk must replace IP-based firewalls.', confidence: 0.97 },
      { id: 'cc2', startTime: 100, endTime: 240, title: '02. Continuous Mutual TLS & Kyber Key Encapsulation', summary: 'Hardening inter-service mesh communications against harvest-now-decrypt-later attacks.', confidence: 0.95 },
      { id: 'cc3', startTime: 240, endTime: 410, title: '03. Dynamic Autonomous Containment Agents', summary: 'AI systems isolating compromised microservices in under 50 milliseconds.', confidence: 0.98 }
    ],
    transcript: [
      { id: 'tc1', startTime: 0, endTime: 35, speaker: 'Vikram Patel', text: 'In a modern distributed cloud, trust is never implicitly granted based on network location.' },
      { id: 'tc2', startTime: 36, endTime: 99, speaker: 'Vikram Patel', text: 'Every API transaction, every database query, and every inter-service gRPC call is dynamically verified with cryptographic tokens.' }
    ],
    keyTakeaways: [
      'Zero trust models verify every request continuously with ephemeral credentials and session risk scores.',
      'Kyber post-quantum lattice cryptography prevents future quantum decryption attacks.',
      'Autonomous containment neutralizes anomalous lateral movement before privilege escalation.'
    ],
    topicAffinities: [
      { topic: 'Cybersecurity & Cloud', weight: 0.99 },
      { topic: 'Cryptography', weight: 0.88 },
      { topic: 'AI & Machine Learning', weight: 0.81 }
    ],
    specs: {
      resolution: '1920x1080 (FHD)',
      codec: 'H.264 / AVC',
      bitrate: '8.4 Mbps',
      aspectRatio: '16:9'
    }
  }
];
