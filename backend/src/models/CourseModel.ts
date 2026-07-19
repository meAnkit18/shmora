import mongoose, { Schema } from 'mongoose';
import type { Course } from '../../../shared/courseTypes.js';

const CourseSchema = new Schema<Record<string, unknown>>(
  {
    id: { type: String, required: true, unique: true, index: true },
    slug: { type: String, default: '', index: true },
    status: { type: String, required: true, index: true },
    version: { type: Number, default: 0 },
    creatorId: { type: String, required: true, index: true },
    creatorName: { type: String, default: '' },
    title: { type: String, default: '' },
    description: { type: String, default: '' },
    category: { type: String, default: '' },
    difficulty: { type: String, default: 'beginner' },
    language: { type: String, default: 'English' },
    thumbnailSeed: { type: Number, default: 0 },
    thumbnailUrl: { type: String },
    tags: { type: [String], default: [] },
    estimatedMinutes: { type: Number, default: 60 },
    learnOutcomes: { type: [String], default: [] },
    requirements: { type: [String], default: [] },
    sections: { type: [Schema.Types.Mixed], default: [] },
    blueprint: { type: Schema.Types.Mixed, required: true },
    stats: { type: Schema.Types.Mixed, required: true },
    createdAt: { type: Number, required: true },
    updatedAt: { type: Number, required: true },
    publishedAt: { type: Number },
  },
  {
    timestamps: false,
    minimize: false,
    versionKey: false,
  },
);

export const CourseModel =
  (mongoose.models.Course as mongoose.Model<Record<string, unknown>>) ??
  mongoose.model<Record<string, unknown>>('Course', CourseSchema);
