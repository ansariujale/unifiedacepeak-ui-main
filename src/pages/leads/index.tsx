import { Icon } from '@/assets/icons/icon';
import { RefreshCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { handleAlert, normalizeSearchText } from '@/lib/utils';
import { deleteContact, deleteLeadGroup } from '@/services/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FC, useState } from 'react';
import AlertConfirm from '@/components/custom/alert-confirm.tsx';
import SideDrawer from '@/components/custom/side-drawer.tsx';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog.tsx';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs.tsx';
import AllLeadsList from './all-leads-list/index.tsx';
import LeadsGroupList from './lead-group-list/index.tsx';
import { LEAD_CREATE_TYPE, LEAD_TABS_CONST } from './const.ts';
import UploadContacts from './upload-contacts.tsx/index.tsx';
import ExportContacts from './export-contacts.tsx/index.tsx';
import LeadContactActivity from './LeadsActivity/index.tsx';
import CreateNewLeadGroup from './add-group-lead-modal/index.tsx';
import { Input } from '@/components/ui/input.tsx';
import { SearchLine } from '@/assets/icons/index.tsx';
// import { ISELECTVALUE } from '@/interfaces/api-interfaces.ts';
import useDebounce from '@/hooks/use-debounce.tsx';
import { useLocation } from 'react-router-dom';
import { useCompanyFeatures } from '@/hooks/rbac.tsx';
import CreateContactNew from '../new-contact/create-new-contact.tsx';
import LeadContactLogs from './lead-contact-logs/index.tsx';
import '@/components/mcm/mcm-page.css';
import './all-leads-list/leads-table.css';
import './add-lead-theme.css';

// export interface IContact {
//   groupId: any;
//   createdAt: string;
//   company: string;
//   website: string;
//   firstName: string;
//   middleName: string;
//   lastName: string;
//   phone: any;
//   email: string;
//   title: string;
//   industry: string;
//   twitter: string;
//   facebook: string;
//   linkedin: string;
//   street: string;
//   city: string;
//   state: string;
//   zipcode: string;
//   country: string | null;
//   description: string;
//   _id: string;
//   countryPrefix: string;
//   contactPic: string;
// }

interface IdrawerState {
  addContact: boolean;
  updateContacts: boolean;
  exportContacts: boolean;
  selectedContact: any;
  leadsActivity: boolean;
  addLead: boolean;
  selectedGroup: any;
  selectedCreateType: string;
}

const Leads: FC = () => {
  const { state } = useLocation();
  const { defaultTab } = state || {};
  const [tabName, setTabName] = useState<string>(defaultTab || LEAD_TABS_CONST.LEAD_LIST);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [search, setSearch] = useState<string>('');
  // const [leadGroup, setLeadGroup] = useState<ISELECTVALUE>();
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState<any>(null);
  const debouncedSearch = useDebounce(search, 1000);
  const normalizedSearch = normalizeSearchText(debouncedSearch);
  const queryClient: any = useQueryClient();
  const { features } = useCompanyFeatures();
  const leadsAccess = features?.plan_features?.campaign?.action || {};

  const [drawerState, setDrawerState] = useState<IdrawerState>({
    addContact: false,
    updateContacts: false,
    exportContacts: false,
    selectedContact: null,
    leadsActivity: false,
    selectedGroup: null,
    addLead: false,
    selectedCreateType: LEAD_CREATE_TYPE.ADD_NEW,
  });
  const [confirmModelState, setConfirmState] = useState<{
    isModal: boolean;
    selectedGroupId: string;
  }>({
    isModal: false,
    selectedGroupId: '',
  });
  const [selectedGroupForContactLogs, setSelectedGroupForContactLogs] = useState<any>(null);

  // const { data: leadGroupList = [] } = useQuery({
  //   queryKey: ['getGroupList'],
  //   queryFn: () => getGroupList(),
  //   select: (res) => res?.data?.data?.result?.rows ?? [],
  //   enabled: Boolean(tabName === LEAD_TABS_CONST.LEAD_GROUP_LIST),
  // });

  const { mutate: mutateDeleteGroup, isPending: isPendingDeleteGroup } = useMutation({
    mutationFn: deleteLeadGroup,
    onSuccess: (data) => {
      if (data?.data?.success) {
        console.log(data?.data?.success, 'data?.data?.success');

        handleAlert({
          text: data?.data?.data?.message || 'Lead group deleted successfully!',
          type: 'success',
        });
        setConfirmState({
          isModal: false,
          selectedGroupId: '',
        });
        queryClient.invalidateQueries(['getGroupListQuery']);
      }
    },
  });

  const { mutate: mutateDeleteContact, isPending: isPendingDeleteContact } = useMutation({
    mutationFn: deleteContact,
    onSuccess: (data) => {
      if (data?.data?.success) {
        handleAlert({
          text: data?.data?.data?.message || 'Lead deleted successfully!',
          type: 'success',
        });
        setShowDeleteConfirmation(null);
        queryClient.invalidateQueries(['getGroupContactsById']);
        queryClient.invalidateQueries(['getGroupListQuery']);
      }
    },
  });

  const handleAddLead = () => {
    setDrawerState((prev) => ({
      ...prev,
      addContact: true,
      selectedContact: null,
    }));
  };

  const handleAddLeadGroup = () => {
    setDrawerState((prev: any) => ({
      ...prev,
      addLead: true,
      selectedGroup: null,
    }));
  };

  const handleTabChange = (value: string) => {
    setTabName(value);
    setSelectedLeads([]);
    if (value !== LEAD_TABS_CONST.LEAD_GROUP_LIST) {
      setSelectedGroupForContactLogs(null);
    }
  };
  const payloadExtraParams: any = {
    ...(normalizedSearch ? { search: normalizedSearch } : {}),
    // filters: [...(leadGroup?.label ? [{ key: 'groupName', value: leadGroup?.label }] : [])],
  };
  return (
    <>
      <section className="mcm-page mcm-admin leads-page-root w-full bg-gray-200/15 flex flex-col overflow-x-auto overflow-y-hidden">
        {selectedGroupForContactLogs ? (
          <LeadContactLogs
            groupData={selectedGroupForContactLogs}
            onBack={() => setSelectedGroupForContactLogs(null)}
            setDrawerState={setDrawerState}
            setShowDeleteConfirmation={setShowDeleteConfirmation}
            contextType="leads"
          />
        ) : (
          <>
            <div className="leads-page-head grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <div>
                <div className="leads-eyebrow">Activity</div>
                <div className="leads-page-head-title-row">
                  <h1>Leads</h1>
                </div>
              </div>
              <Tabs
                value={tabName}
                onValueChange={handleTabChange}
                className="col-start-2 w-auto justify-self-center"
              >
                <TabsList className="leads-tabs-list inline-flex h-auto w-fit items-center gap-1 rounded-full border border-gray-200 bg-gray-100 p-1">
                  <TabsTrigger
                    value={LEAD_TABS_CONST.LEAD_LIST}
                    className="leads-tab-trigger cursor-pointer rounded-full px-4 py-1.5 text-xs font-semibold text-gray-500 shadow-none sm:text-sm"
                  >
                    {LEAD_TABS_CONST.LEAD_LIST}
                  </TabsTrigger>
                  <TabsTrigger
                    value={LEAD_TABS_CONST.LEAD_GROUP_LIST}
                    className="leads-tab-trigger cursor-pointer rounded-full px-4 py-1.5 text-xs font-semibold text-gray-500 shadow-none sm:text-sm"
                  >
                    {LEAD_TABS_CONST.LEAD_GROUP_LIST}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <div />
            </div>
            <div className="leads-card">
              <div className="flex flex-col gap-3 border-b border-gray-200 bg-white px-2 py-2 md:min-h-[65px] md:flex-row md:items-center md:justify-end md:px-3 md:py-0">
              <div className="filters flex w-full items-center gap-2 md:flex-nowrap">
                {/* {selectedLeads && selectedLeads?.length && tabName === LEAD_TABS_CONST.LEAD_LIST ? (
                  <CustomSelect
                    options={[LEAD_CREATE_TYPE.ADD_NEW, LEAD_CREATE_TYPE.ADD_IN_EXISTING].map(
                      (item) => ({
                        value: item,
                        label: item,
                      }),
                    )}
                    value={drawerState.selectedCreateType}
                    handleChange={(value) => {
                      setDrawerState((prev) => ({
                        ...prev,
                        selectedCreateType: value?.value,
                        addLead: true,
                      }));
                    }}
                  />
                ) : null} */}
                <div className="min-w-0 flex-1 md:w-[240px] md:flex-none lg:w-[280px]">
                  <Input
                    placeholder="Search"
                    className="min-h-9 rounded-full pl-11 focus:!border-[#fca5a5] hover:!border-[#fca5a5]"
                    IconPosition="left-0 inset-y-0 pl-2"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                    }}
                    Icon={
                      <span className="flex items-center justify-center w-[22px] h-[22px] rounded-full bg-[#fef2f2]">
                        <SearchLine className="text-[#f87171] !w-3 !h-3" />
                      </span>
                    }
                  />
                </div>
                <button
                  type="button"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 hover:text-gray-900"
                  aria-label="Refresh"
                  onClick={() => {
                    queryClient.invalidateQueries({ queryKey: ['getGroupContactsById'], exact: false });
                    queryClient.invalidateQueries({ queryKey: ['getGroupList'], exact: false });
                  }}
                >
                  <RefreshCcw className="w-4 h-4" />
                </button>
                {/* <CustomSelect
                  placeholder="Select lead group"
                  isClearable
                  options={
                    leadGroupList &&
                    leadGroupList?.length > 0 &&
                    leadGroupList?.map(({ groupName, _id }: { groupName: string; _id: string }) => ({
                      label: groupName,
                      value: _id,
                    }))
                  }
                  handleChange={(e: ISELECTVALUE) => setLeadGroup(e)}
                  value={leadGroup}
                  inputClass="team_chat"
                /> */}
                <div className="flex items-center gap-2 md:ml-auto">
                  <Button
                    className="flex h-9 w-9 shrink-0 max-h-9 max-w-9 min-h-9 min-w-9 cursor-pointer items-center justify-center rounded-lg border border-primary bg-white text-primary hover:bg-primary hover:text-white"
                    type="button"
                    onClick={() => setDrawerState((prev) => ({ ...prev, updateContacts: true }))}
                    title="Upload Contacts"
                  >
                    <Icon name="UploadLineIcon" className="w-5 h-5" />
                  </Button>
                  {tabName === LEAD_TABS_CONST.LEAD_LIST && (
                    <>
                      <Button
                        className="flex h-9 w-9 shrink-0 max-h-9 max-w-9 min-h-9 min-w-9 cursor-pointer items-center justify-center rounded-lg border border-primary bg-white text-primary hover:bg-primary hover:text-white"
                        type="button"
                        onClick={() =>
                          setDrawerState((prev) => ({ ...prev, exportContacts: true }))
                        }
                        title="Export Contacts"
                      >
                        <Icon name="DownloadLine" className="w-5 h-5" />
                      </Button>
                    </>
                  )}

                  {leadsAccess?.add && (
                    <Button
                      className="flex h-9 w-9 shrink-0 max-h-9 max-w-9 min-h-9 min-w-9 cursor-pointer items-center justify-center rounded-lg border border-primary bg-white text-primary hover:bg-primary hover:text-white"
                      type="button"
                      onClick={() =>
                        tabName === LEAD_TABS_CONST.LEAD_GROUP_LIST
                          ? handleAddLeadGroup()
                          : handleAddLead()
                      }
                    >
                      <Icon name="Plus" className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
            <div className="w-full flex flex-col gap-2">
              {(() => {
                switch (tabName) {
                  case LEAD_TABS_CONST.LEAD_LIST:
                    return (
                      <AllLeadsList
                        {...{
                          setDrawerState,
                          setShowDeleteConfirmation,
                          selectedLeads,
                          setSelectedLeads,
                          payloadExtraParams,
                        }}
                      />
                    );
                  case LEAD_TABS_CONST.LEAD_GROUP_LIST:
                    return (
                      <LeadsGroupList
                        {...{
                          setConfirmState,
                          setDrawerState,
                          isLead: true,
                          onOpenContactLogs: (group: any) => setSelectedGroupForContactLogs(group),
                          search: normalizedSearch,
                        }}
                      />
                    );
                  default:
                    return <AllLeadsList {...{ setDrawerState, setShowDeleteConfirmation }} />;
                }
              })()}
            </div>
            </div>
          </>
        )}
      </section>
      <UploadContacts
        drawerState={drawerState.updateContacts}
        setDrawerState={(val) => setDrawerState((prev) => ({ ...prev, updateContacts: val }))}
      />
      <ExportContacts
        drawerState={drawerState.exportContacts}
        setDrawerState={(val) => setDrawerState((prev) => ({ ...prev, exportContacts: val }))}
      />
      {drawerState?.addContact && (
        <Dialog
          open={drawerState?.addContact}
          onOpenChange={(open) => {
            if (!open) setDrawerState((prev) => ({ ...prev, addContact: false }));
          }}
        >
          <DialogContent className="leads-lead-modal" showCloseButton={false}>
            <div className="leads-add-lead-theme">
              <div className="lead-modal-head">
                <div className="min-w-0">
                  <DialogTitle className="lead-modal-title">
                    {drawerState?.selectedContact
                      ? `Update Lead (${drawerState?.selectedContact?.name?.first || ''} ${drawerState?.selectedContact?.name?.last || ''})`
                      : 'Add Lead'}
                  </DialogTitle>
                </div>
                <button
                  type="button"
                  className="lead-modal-close"
                  aria-label="Close"
                  onClick={() => setDrawerState((prev) => ({ ...prev, addContact: false }))}
                >
                  <X size={16} />
                </button>
              </div>
              <CreateContactNew
                contactData={drawerState?.selectedContact}
                isDisable={false}
                setIsDisable={() => void 0}
                setDrawerState={() => void 0}
                keepFormDataAfterSave
                isLead={true}
                handleClose={() => setDrawerState((prev) => ({ ...prev, addContact: false }))}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {!!showDeleteConfirmation && (
        <AlertConfirm
          {...{
            apiLoading: isPendingDeleteContact,
            onConfirm: () => {
              mutateDeleteContact({ contact_uuid: [showDeleteConfirmation?._id] });
            },
            open: !!showDeleteConfirmation,
            setOpen: () => setShowDeleteConfirmation(null),
          }}
        />
      )}
      {drawerState?.leadsActivity && (
        <SideDrawer
          title=""
          isTab={false}
          enableResponsive
          isOpen={drawerState?.leadsActivity}
          handleClose={() => setDrawerState((prev) => ({ ...prev, leadsActivity: false }))}
          content={<LeadContactActivity rowData={drawerState?.selectedContact} />}
        />
      )}
      <AlertConfirm
        {...{
          apiLoading: isPendingDeleteGroup,
          onConfirm: () => {
            mutateDeleteGroup({ groupId: confirmModelState?.selectedGroupId, type: 'LEAD' });
          },
          open: confirmModelState?.isModal,
          setOpen: () => {
            setConfirmState({
              isModal: false,
              selectedGroupId: '',
            });
          },
        }}
      />
      {drawerState.addLead && (
        <CreateNewLeadGroup
          group={drawerState?.selectedGroup}
          selectedCreateType={drawerState?.selectedCreateType}
          onAddInExistingGroup={() => setSelectedLeads([])}
          selectedLeads={selectedLeads}
          modalState={drawerState.addLead}
          setModalState={() =>
            setDrawerState((prev) => ({
              ...prev,
              addLead: false,
              selectedGroup: null,
              selectedCreateType: LEAD_CREATE_TYPE.ADD_NEW,
            }))
          }
        />
      )}
    </>
  );
};

export default Leads;
