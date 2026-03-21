import { notFound } from 'next/navigation';
import { LogicCoursePage } from '../_shared/LogicCoursePage';
import { logicCourseBySlug, logicCourses } from '../_shared/logicCourses';

export function generateStaticParams() {
  return logicCourses.map(course => ({ slug: course.slug }));
}

export default async function STLogicCourseRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const course = logicCourseBySlug[slug];

  if (!course) {
    notFound();
  }

  return <LogicCoursePage course={course} />;
}
