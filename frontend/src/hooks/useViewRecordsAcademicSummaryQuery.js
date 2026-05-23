import { useQuery } from '@tanstack/react-query';
import { staffApi } from '../lib/api/staffApi';

export function useViewRecordsAcademicSummaryQuery(studentId) {
  return useQuery({
    queryKey: ['staffStudentAcademicSummary', studentId],
    queryFn: () => staffApi.getAcademicSummary(studentId),
    enabled: !!studentId,
  });
}
