syntax clear
syntax case ignore
syntax match logoComment /;.*/
syntax region logoList start=/\[/ end=/\]/
syntax match logoWord /"\S*/
syntax match logoThing /:\S*/
"syntax match logoProcedure /
setlocal iskeyword+=.
syntax keyword logoSpecialForm to end .macro
highlight link logoComment Comment
highlight link logoWord String
highlight link logoList String
highlight link logoThing Identifier
highlight link logoProcedure Function
highlight link logoSpecialForm Statement
