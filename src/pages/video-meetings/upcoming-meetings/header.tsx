import { Icon } from '@/assets/icons/icon';
import { createMeeting } from '@/services/api';
import { useMutation } from '@tanstack/react-query';
import moment from 'moment';
import { useState } from 'react';
import JoinMeetingModal from './join-meeting-modal';
import ScheduleMeeting from '../schedule-meeting';
import SideDrawer from '@/components/custom/side-drawer';
import { useCompanyFeatures } from '@/hooks/rbac';
import { CalendarDays, User, Video, VideoIcon } from 'lucide-react';

const MeetingHeader = ({ formInstance }: any) => {
  const [drawerState, setDrawerState] = useState<any>(false);
  const [modalState, setModalState] = useState(false);
  const { features } = useCompanyFeatures();
  const videAccess = features?.plan_features?.video?.action || {};
  const { mutate: mutateInstantMeeting, isPending: isPendingInstantMeeting } = useMutation({
    mutationFn: createMeeting,
    onSuccess: (data) => {
      const meetingData = data?.data?.data?.result;
      const meetingId = meetingData?.meetingId;
      window.open(`/video-meet?meetCode=${meetingId}`);
    },
  });

  const InstantMeeting = async () => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const normalizedTz = tz === 'Asia/Calcutta' ? 'Asia/Kolkata' : tz;
    const now = new Date();
    const payload = {
      name: '',
      startTime: moment(now).format('YYYY-MM-DD HH:mm:ss'),
      allowHost: 'Y',
      timezone: normalizedTz,
      meetingType: 'INSTANT',
      mode: 'VIDEO',
      duration: 0,
    };
    mutateInstantMeeting(payload);
  };

  return (
    <div className="flex w-full flex-col gap-4 sm:pt-3">
      <div
        className="relative w-full flex flex-col gap-3 overflow-hidden rounded-2xl bg-white
      bg-[linear-gradient(120deg,_#fef1f1_0%,_#ffffff_45%,_#ffffff_60%,_#fdeceb_100%)] px-6 py-6 shadow-xs sm:px-8 sm:py-6
      lg:flex-row lg:items-center lg:justify-between"
      >
        <div className="flex flex-col gap-2 w-full max-w-[480px]">
          <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">
            <VideoIcon className="h-3 w-3" /> Video Meetings
          </div>
          <div className="w-full whitespace-nowrap text-xl sm:text-2xl font-bold leading-tight text-gray-900">
            Connect, Collaborate, <span className="text-primary">Get More Done</span>
          </div>
          <div className="flex w-full flex-nowrap items-center gap-2 pt-1">
            {videAccess?.create && (
              <button
                type="button"
                className="flex h-9 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-3.5 text-white shadow-sm transition-colors hover:bg-primary/90"
                onClick={() => {
                  if (isPendingInstantMeeting) return;
                  InstantMeeting();
                }}
              >
                <Icon name="VideocameraAdd" className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">
                  {isPendingInstantMeeting ? 'Please Wait' : 'Start Meeting'}
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setModalState(true)}
              className="flex h-9 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 text-gray-900 shadow-sm transition-colors hover:bg-gray-50"
            >
              <Icon name="PlusIcon" className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">Join Meeting</span>
            </button>
            {videAccess?.create && (
              <button
                type="button"
                onClick={() => setDrawerState(true)}
                className="flex h-9 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 text-gray-900 shadow-sm transition-colors hover:bg-gray-50"
              >
                <Icon name="CalendarIcon" className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">Schedule Meeting</span>
              </button>
            )}
          </div>
        </div>

        {/* Decorative illustration — a wide soft-pink wash filling most of
            the panel, a white "play" card with a duotone camera glyph at its
            centre, a darker pink accent circle tucked behind its corner, and
            an avatar chip / calendar chip trailing off dotted paths. All
            built from divs/icons, no image asset. Hidden on small screens
            where there's no room for it. */}
        <div className="relative hidden h-28 w-full max-w-[280px] shrink-0 items-center justify-center overflow-visible lg:flex">
          <div className="absolute -right-6 h-32 w-56 rounded-full bg-primary/10 blur-xl" />
          <div className="absolute h-16 w-16 -translate-x-3 translate-y-5 rounded-full bg-primary/25" />
          <div className="absolute right-6 top-1 h-2 w-2 rounded-full bg-primary/40" />
          <div className="absolute bottom-4 left-16 h-1.5 w-1.5 rounded-full bg-primary/40" />

          {/* Dotted connector paths from each chip to the center card. */}
          {[0, 1, 2, 3].map((i) => (
            <span
              key={`dot-top-${i}`}
              className="absolute h-1 w-1 rounded-full bg-primary/40"
              style={{ left: `${46 - i * 11}px`, top: `${44 - i * 7}px` }}
            />
          ))}
          {[0, 1, 2, 3].map((i) => (
            <span
              key={`dot-bottom-${i}`}
              className="absolute h-1 w-1 rounded-full bg-primary/40"
              style={{ right: `${46 - i * 11}px`, bottom: `${40 - i * 7}px` }}
            />
          ))}

          <div className="absolute left-4 top-1 z-10 flex h-9 w-9 items-center justify-center rounded-2xl bg-white shadow-md">
            <User className="h-4 w-4 text-primary" />
          </div>

          <div className="relative z-10 flex h-20 w-20 items-center justify-center rounded-[28px] bg-white shadow-xl">
            <Video className="h-9 w-9 text-red-400" fill="currentColor" strokeWidth={0} />
          </div>

          <div className="absolute bottom-1 right-4 z-10 flex h-9 w-9 items-center justify-center rounded-2xl bg-white shadow-md">
            <CalendarDays className="h-4 w-4 text-primary" />
          </div>
        </div>
      </div>
      {modalState && (
        <JoinMeetingModal
          modalState={modalState}
          setModalState={setModalState}
          formInstance={formInstance}
        />
      )}
      {drawerState && (
        <SideDrawer
          isOpen={drawerState}
          title="Schedule New Meeting"
          handleClose={() => setDrawerState(false)}
          content={<ScheduleMeeting setDrawerState={setDrawerState} />}
          isHeader={true}
          width="650px"
          enableResponsive
          responsiveWidth="96vw"
          responsiveBreakpoint={1024}
        />
      )}
    </div>
  );
};

export default MeetingHeader;
