export type TokenType = 'bot' | 'user';

export type SlackApiResponse = {
  ok: boolean;
  error?: string;
  [key: string]: unknown;
};

export type SlackResponseMetadata = {
  next_cursor?: string;
};

export type SlackChannel = {
  id?: string;
  name?: string;
  is_archived?: boolean;
  [key: string]: unknown;
};

export type SlackMessage = {
  type?: string;
  user?: string;
  text?: string;
  ts?: string;
  thread_ts?: string;
  reply_count?: number;
  [key: string]: unknown;
};

export type SlackSearchMatch = {
  ts?: string;
  channel?: {
    id?: string;
    name?: string;
  };
  [key: string]: unknown;
};

export type SlackFile = {
  id?: string;
  name?: string;
  title?: string;
  filetype?: string;
  size?: number;
  created?: number;
  updated?: number;
  user?: string;
  permalink?: string;
  url_private?: string;
  [key: string]: unknown;
};

export type SlackUser = {
  id?: string;
  name?: string;
  real_name?: string;
  profile?: SlackUserProfile;
  [key: string]: unknown;
};

export type SlackUserProfile = {
  real_name?: string;
  email?: string;
  phone?: string;
  [key: string]: unknown;
};

export type SlackChannelsListResponse = SlackApiResponse & {
  channels?: SlackChannel[];
  response_metadata?: SlackResponseMetadata;
};

export type SlackChannelInfoResponse = SlackApiResponse & {
  channel?: SlackChannel;
};

export type SlackChatPostMessageResponse = SlackApiResponse & {
  channel?: string;
  ts?: string;
  message?: SlackMessage;
};

export type SlackReactionsAddResponse = SlackApiResponse;

export type SlackConversationsHistoryResponse = SlackApiResponse & {
  messages?: SlackMessage[];
  has_more?: boolean;
  response_metadata?: SlackResponseMetadata;
};

export type SlackConversationsRepliesResponse = SlackApiResponse & {
  messages?: SlackMessage[];
  has_more?: boolean;
  response_metadata?: SlackResponseMetadata;
};

export type SlackSearchMessagesResponse = SlackApiResponse & {
  messages?: {
    total?: number;
    matches?: SlackSearchMatch[];
    paging?: unknown;
  };
};

export type SlackUsersListResponse = SlackApiResponse & {
  members?: SlackUser[];
  response_metadata?: SlackResponseMetadata;
};

export type SlackUsersProfileGetResponse = SlackApiResponse & {
  profile?: SlackUserProfile;
};

export type SlackFilesListResponse = SlackApiResponse & {
  files?: SlackFile[];
  paging?: unknown;
};

export type SlackFilesInfoResponse = SlackApiResponse & {
  file?: SlackFile;
};

export interface CanvasChange {
  operation:
    | 'insert_at_start'
    | 'insert_at_end'
    | 'insert_before'
    | 'insert_after'
    | 'replace'
    | 'delete';
  section_id?: string;
  document_content?: {
    type: 'markdown';
    markdown: string;
  };
}
