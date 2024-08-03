// See https://partner.steamgames.com/doc/store/localization/languages

export interface SteamLanguage {
	name: string;
	native: string;
	code: string;
	api: string;
}

export const steamLanguages: SteamLanguage[] = [
	{ name: 'Arabic *', native: 'العربية', code: 'arabic', api: 'ar' },
	{ name: 'Bulgarian', native: 'български език', code: 'bulgarian', api: 'bg' },
	{ name: 'Chinese (Simplified)', native: '简体中文', code: 'schinese', api: 'zh-CN' },
	{ name: 'Chinese (Traditional)', native: '繁體中文', code: 'tchinese', api: 'zh-TW' },
	{ name: 'Czech', native: 'čeština', code: 'czech', api: 'cs' },
	{ name: 'Danish', native: 'Dansk', code: 'danish', api: 'da' },
	{ name: 'Dutch', native: 'Nederlands', code: 'dutch', api: 'nl' },
	{ name: 'English', native: 'English', code: 'english', api: 'en' },
	{ name: 'Finnish', native: 'Suomi', code: 'finnish', api: 'fi' },
	{ name: 'French', native: 'Français', code: 'french', api: 'fr' },
	{ name: 'German', native: 'Deutsch', code: 'german', api: 'de' },
	{ name: 'Greek', native: 'Ελληνικά', code: 'greek', api: 'el' },
	{ name: 'Hungarian', native: 'Magyar', code: 'hungarian', api: 'hu' },
	{ name: 'Indonesian', native: 'Bahasa Indonesia', code: 'indonesian', api: 'id' },
	{ name: 'Italian', native: 'Italiano', code: 'italian', api: 'it' },
	{ name: 'Japanese', native: '日本語', code: 'japanese', api: 'ja' },
	{ name: 'Korean', native: '한국어', code: 'koreana', api: 'ko' },
	{ name: 'Norwegian', native: 'Norsk', code: 'norwegian', api: 'no' },
	{ name: 'Polish', native: 'Polski', code: 'polish', api: 'pl' },
	{ name: 'Portuguese', native: 'Português', code: 'portuguese', api: 'pt' },
	{ name: 'Portuguese-Brazil', native: 'Português-Brasil', code: 'brazilian', api: 'pt-BR' },
	{ name: 'Romanian', native: 'Română', code: 'romanian', api: 'ro' },
	{ name: 'Russian', native: 'Русский', code: 'russian', api: 'ru' },
	{ name: 'Spanish-Spain', native: 'Español-España', code: 'spanish', api: 'es' },
	{ name: 'Spanish-Latin America', native: 'Español-Latinoamérica', code: 'latam', api: 'es-419' },
	{ name: 'Swedish', native: 'Svenska', code: 'swedish', api: 'sv' },
	{ name: 'Thai', native: 'ไทย', code: 'thai', api: 'th' },
	{ name: 'Turkish', native: 'Türkçe', code: 'turkish', api: 'tr' },
	{ name: 'Ukrainian', native: 'Українська', code: 'ukrainian', api: 'uk' },
	{ name: 'Vietnamese', native: 'Tiếng Việt', code: 'vietnamese', api: 'vn' }
];
