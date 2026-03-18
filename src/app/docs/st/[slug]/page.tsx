import { notFound } from 'next/navigation';
import { LogicCoursePage } from '../_shared/LogicCoursePage';
import { logicCourseBySlug, logicCourses } from '../_shared/logicCourses';

export function generateStaticParams() {
  return logicCourses.map(course => ({ slug: course.slug }));
}

export default function STLogicCourseRoute({ params }: { params: { slug: string } }) {
  const course = logicCourseBySlug[params.slug];

  if (!course) {
    notFound();
  }

  return <LogicCoursePage course={course} />;
}
