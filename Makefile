all: publish

publish:
	@npm version ${VERSION}
	@git push origin master --tags
	@git push github master --tags
	@npm publish
