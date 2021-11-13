export interface DexSettings {
    deadline: number;
    slippage: number;
    gas: number;
    enableGasOverride: boolean;
}

export interface ValonPost {
    author: {
        name: string;
        url: string;
        avatar: string;
    }
    authors: {
        avatar: string;
        name: string;
        url: string;
    }[];
    content_html: string;
    content_text: string;
    date_published: string;
    id: string;
    tags: string[];
    title: string;
    url: string;
}

export interface ValonFeed {
    description: string;
    feed_url: string;
    home_page_url: string;
    icon: string;
    items: ValonPost[];
    language: string;
    title: string;
    user_comment: string;
    version: string;
}
  