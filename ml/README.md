# ML — Waste Classification Model

This directory will contain the EcoDistrict ML pipeline for waste image classification.

## Planned Architecture

```
Image
  → preprocessing/preprocess.py   (resize, normalise, augment)
  → training/train.py              (CNN training on labelled dataset)
  → evaluation/evaluate.py         (accuracy, confusion matrix)
  → models/classifier.pkl          (saved trained model)
```

## Target Categories

- Plastic
- Paper
- Glass
- Metal
- Organic
- E-waste
- Textile
- Other

## Pipeline Summary (Phase 3)

1. Collect and label a waste image dataset
2. Preprocess images (224×224, normalise, augment)
3. Train a CNN classifier (TensorFlow or PyTorch — TBD)
4. Evaluate on held-out test set
5. Export model to `ml/models/`
6. Wire into `backend/routes/ai.py` for inference

**No generative AI API is used. The model is trained from scratch on a real dataset.**

## Status

Phase 1 — Folder structure only. No model yet.
