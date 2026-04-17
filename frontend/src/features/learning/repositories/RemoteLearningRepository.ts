import type { CourseProgress, LessonProgress } from "../types";
import type { LearningRepository } from "./LearningRepository";

export class RemoteLearningRepository implements LearningRepository {
  async getCourseProgress(
    _learnerId: string,
    _courseId: string
  ): Promise<CourseProgress | null> {
    throw new Error("RemoteLearningRepository is not implemented yet.");
  }

  async saveCourseProgress(_progress: CourseProgress): Promise<void> {
    throw new Error("RemoteLearningRepository is not implemented yet.");
  }

  async getLessonProgress(
    _learnerId: string,
    _courseId: string,
    _lessonId: string
  ): Promise<LessonProgress | null> {
    throw new Error("RemoteLearningRepository is not implemented yet.");
  }

  async saveLessonProgress(_progress: LessonProgress): Promise<void> {
    throw new Error("RemoteLearningRepository is not implemented yet.");
  }

  async getAllLessonProgress(
    _learnerId: string,
    _courseId: string
  ): Promise<LessonProgress[]> {
    throw new Error("RemoteLearningRepository is not implemented yet.");
  }
}
