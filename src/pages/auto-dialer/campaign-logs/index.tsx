import ActivityList from '@/components/activity-list/activity-list';
import CustomSelect from '@/components/custom/custom-select';
import CustomTooltip from '@/components/custom/custom-tooltip';
import { ISELECTVALUE } from '@/interfaces/api-interfaces';
import { dropdownList } from '@/services/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { RefreshCcw, Search } from 'lucide-react';
import useDebounce from '@/hooks/use-debounce';
import { campaignTypeOptions } from '../campaign/const';
import './campaign-logs-head.css';

/* TEMP: sample rows for reviewing the table with the account empty (the
   real endpoint currently errors — no DB connection in this env).
   Mimics the real API's response shape, `states` included, so both the
   KPI cards and the table's footer/pager keep working. Remove and go
   back to the default fetcher (drop the `fetcherFnOverride` prop below)
   once real data exists. */
const fetchDummyCampaignLogs = () =>
  Promise.resolve({
    data: {
      data: {
        result: {
          totalItems: 3,
          totalPages: 1,
          rows: [
            {
              _id: 'dummy-log-1',
              contactName: 'Test Sharma',
              contactNumber: '+14422129610',
              type: 'CALL',
              didNumber: '+14422129610',
              campaignDetail: { campaignName: 'Spring promo outreach' },
              billSec: 184,
              callEndTime: '2026-09-05T10:12:00.000Z',
              totalCallAttempts: 2,
              sipcallDetail: [],
              disposition: { disposition: 'INTERESTED' },
              systemDisposition: 'ANSWERED',
              notes: [],
            },
            {
              _id: 'dummy-log-2',
              contactName: 'Aakash Rao',
              contactNumber: '+19578642210',
              type: 'CALL',
              didNumber: '+19578642210',
              campaignDetail: { campaignName: 'Renewal reminders' },
              billSec: 0,
              callEndTime: '2026-09-03T15:40:00.000Z',
              totalCallAttempts: 1,
              sipcallDetail: [],
              disposition: { disposition: '' },
              systemDisposition: 'NO_ANSWER',
              notes: [],
            },
            {
              _id: 'dummy-log-3',
              contactName: 'Priya Nair',
              contactNumber: '+16008314958',
              type: 'CALL',
              didNumber: '+16008314958',
              campaignDetail: { campaignName: 'Welcome call series' },
              billSec: 245,
              callEndTime: '2026-09-01T09:05:00.000Z',
              totalCallAttempts: 3,
              sipcallDetail: [],
              disposition: { disposition: 'CALLBACK' },
              systemDisposition: 'ANSWERED',
              notes: [],
            },
          ],
          states: {
            totalCall: 3,
            DialedCall: 3,
            PendingCall: 0,
            connected: 2,
            DialedButNotAnswered: 1,
            dnc: 0,
          },
        },
      },
    },
  });

const CampaignLogs = () => {
  const [campaignType, setCampaignType] = useState<ISELECTVALUE>();
  const [campaign, setCampaign] = useState<any>();
  const [disposition, setDisposition] = useState<any>();
  const [campaignStatistics, setCampaignStatistics] = useState<any>(null);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);
  const queryClient = useQueryClient();
  console.log(disposition, 'dispositiondisposition', campaign);

  const getCardValue = (keys: string[]) =>
    keys.reduce(
      (acc, key) => {
        if (acc !== null) return acc;
        const value = campaignStatistics?.states?.[key];
        return value !== undefined && value !== null ? value : null;
      },
      null as number | null,
    ) || 0;

  const cardStatusMap: Record<string, string> = {
    Dialed: 'DialedCall',
    Pending: 'PendingCall',
    Connected: 'connected',
    'No Answers': 'DialedButNotAnswered',
    DNC: 'dnc',
  };

  const payloadExtraParams = {
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    filters: [
      ...(campaign?.value ? [{ key: 'campaign_uuid', value: campaign?.value }] : []),
      ...(campaignType?.value ? [{ key: 'campaignType', value: campaignType?.value }] : []),
      ...(disposition?.value ? [{ key: 'disposition_uuid', value: disposition?.label }] : []),
      ...(selectedCard && cardStatusMap[selectedCard]
        ? [{ key: cardStatusMap[selectedCard], value: cardStatusMap[selectedCard] }]
        : []),
    ],
  };
  const { data: campaignListData = {}, isLoading: isPendingDepartmentList } = useQuery({
    queryKey: ['dropdownList', campaignType],
    queryFn: () =>
      dropdownList({
        ...(campaignType?.value ? { search: campaignType.value } : {}),
      }),
    select: (data) => data?.data?.data?.result?.rows || [],
  });

  return (
    // <div className="flex flex-col w-full">
    <div className="w-full bg-[#e3e3e3] flex flex-col overflow-x-auto overflow-y-hidden h-full">
      <div className="flex items-center justify-between px-[26px] pt-5 pb-1 border-b border-gray-200 bg-white">
        <div>
          <div className="cl-eyebrow">Activity</div>
          <p className="cl-title">Statistics</p>
        </div>
        <div className="flex items-center gap-2 filters">
          <CustomSelect
            isClearable
            placeholder="Campaign type"
            options={campaignTypeOptions || []}
            handleChange={(e: ISELECTVALUE) => {
              setCampaignType(e);
              setCampaign(undefined);
              setDisposition(undefined);
              setSelectedCard(null);
            }}
            value={campaignType}
            inputClass="team_chat cl-filter"
            className="w-auto flex-none"
          />
          <CustomSelect
            isClearable
            placeholder="Campaign name"
            className="w-auto flex-none"
            isLoading={isPendingDepartmentList}
            options={
              (campaignListData &&
                campaignListData?.length > 0 &&
                campaignListData?.map(({ name, _id }: { name: string; _id: string }) => ({
                  label: name,
                  value: _id,
                }))) ||
              []
            }
            handleChange={(e: ISELECTVALUE) => {
              setCampaign(e);
              setDisposition(undefined);
              setSelectedCard(null);
            }}
            value={campaign}
            inputClass="team_chat cl-filter"
          />
          {!campaign?.value ? (
            <CustomTooltip text="Please select campaign name first" side="top">
              <div className="w-full cursor-not-allowed">
                <CustomSelect
                  isDisabled
                  isClearable
                  placeholder="Disposition"
                  options={[]}
                  handleChange={() => {}}
                  value={disposition}
                  inputClass="team_chat cl-filter"
                />
              </div>
            </CustomTooltip>
          ) : (
            <CustomSelect
              isClearable
              placeholder="Disposition"
              isLoading={isPendingDepartmentList}
              options={(() => {
                const selectedCampaignData =
                  campaignListData?.length &&
                  campaignListData?.find((c: any) => c._id === campaign?.value);
                const agentDispo = selectedCampaignData?.agentDisposition || [];
                return agentDispo.map(
                  ({ disposition, _id }: { disposition: any; _id: string }) => ({
                    label: disposition?.name,
                    value: _id,
                  }),
                );
              })()}
              handleChange={(e: ISELECTVALUE) => setDisposition(e)}
              value={disposition}
              inputClass="team_chat cl-filter"
            />
          )}
        </div>
      </div>
      <div>
        <div className="cl-kpis">
          {[
            { label: 'Total Contacts', keys: ['totalCall', 'totalContacts'] },
            { label: 'Dialed', keys: ['DialedCall', 'dialedCall', 'dialed'] },
            { label: 'Pending', keys: ['PendingCall', 'pendingCall', 'pending'] },
            { label: 'Connected', keys: ['connected', 'Connected', 'answered'] },
            {
              label: 'No Answers',
              keys: ['DialedButNotAnswered', 'dialedButNotAnswered', 'notAnswered'],
            },
            { label: 'DNC', keys: ['dnc', 'DNC'] },
          ].map((card) => {
            const isSelected =
              selectedCard === card.label || (!selectedCard && card.label === 'Total Contacts');
            return (
              <div
                key={card.label}
                onClick={() => setSelectedCard(card.label)}
                className={`cl-kpi${isSelected ? ' is-selected' : ''}`}
              >
                <div className="cl-kpi-label">{card.label}</div>
                <div className="cl-kpi-value">{getCardValue(card.keys)}</div>
              </div>
            );
          })}
        </div>
      </div>
      <div>
        <div className="cl-card">
          <div className="cl-toolbar">
            <div className="cl-search">
              <span className="cl-search-ico" aria-hidden="true">
                <Search />
              </span>
              <input
                placeholder="Search campaign logs"
                aria-label="Search campaign logs"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <button
              type="button"
              className="cl-refresh"
              aria-label="Refresh campaign logs"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['campaignLogs'] })}
            >
              <RefreshCcw className="w-4 h-4" />
            </button>
          </div>
          <ActivityList
            payloadExtraParams={payloadExtraParams}
            activityType="campaignLogs"
            contactId={''}
            notesOnlyAction
            fetcherFnOverride={fetchDummyCampaignLogs}
            onTableSuccess={(data) => {
              if (data?.data?.data?.result) {
                setCampaignStatistics(data.data.data.result);
              }
            }}
            emptyPlaceholder="No campaign logs found"
            description="Campaign activity will appear here once campaigns start running."
          />
        </div>
      </div>
    </div>
  );
};

export default CampaignLogs;
